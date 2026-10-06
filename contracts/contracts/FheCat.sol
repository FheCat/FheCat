// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {FHE, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {IFheCatRenderer} from "./interfaces/IFheCatRenderer.sol";

/// @title FheCat
/// @notice Pixel cats whose DNA is born encrypted on Fhenix CoFHE: Schrodinger's cats.
///
/// Every mint draws a 64-bit DNA with `FHE.randomEuint64()`. It only exists as a
/// ciphertext, and at birth only this contract is on its ACL, so no wallet - not the
/// team, not the minter, not a bot - can decrypt it. Each cat then moves one way
/// through these states, and only by its holder's choice:
///
///  - Unopened: nobody has ever been able to see the cat. Provable on-chain.
///  - Peeked:   a holder took private decryption rights (`peek`). Still hidden from
///              everyone else, but the flag is permanent, so a buyer knows a seller
///              may have seen it. (CoFHE ACL grants cannot be revoked.)
///  - Opened:   the holder made the DNA publicly decryptable (`open`); anyone can now
///              publish it with the threshold network's signature (`reveal`).
///  - Revealed: the DNA is on-chain and the cat is drawn.
///
/// Nothing forces a reveal: a cat can stay sealed forever. A holder who has peeked can
/// also reveal directly with their own decryption proof.
contract FheCat is IERC4906, ERC721, ERC2981, Ownable2Step, ReentrancyGuard {
    enum Phase {
        Closed,
        Allowlist,
        Public
    }

    enum State {
        Unopened,
        Peeked,
        Opened,
        Revealed
    }

    struct Cat {
        euint64 dna;
        uint64 revealedDna;
        bool peeked;
        bool opened;
        bool revealed;
    }

    struct CatView {
        uint256 tokenId;
        address owner;
        bytes32 dnaHandle;
        State state;
        bool peeked;
        bool opened;
        bool revealed;
        uint64 dna;
    }

    uint256 public constant MAX_PER_TX = 10;

    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    Phase public phase;
    uint256 public publicPrice;
    uint256 public allowlistPrice;
    /// @notice Public-phase mints per wallet; 0 means no limit.
    uint256 public maxPerWallet;
    /// @notice Allowlist-phase mints per wallet; 0 means no limit.
    uint256 public allowlistMaxPerWallet;
    bytes32 public allowlistRoot;

    IFheCatRenderer public renderer;
    /// @notice The game contract holders may let compute on their cat's encrypted DNA. 0 = none yet.
    address public arena;

    mapping(uint256 tokenId => Cat) private _cats;
    mapping(address minter => uint256) public publicMinted;
    mapping(address minter => uint256) public allowlistMinted;

    event CatBorn(uint256 indexed tokenId, address indexed to, bytes32 dnaHandle);
    event CatPeeked(uint256 indexed tokenId, address indexed holder);
    event CatOpened(uint256 indexed tokenId, bytes32 dnaHandle);
    event CatRevealed(uint256 indexed tokenId, uint64 dna);
    event CatEnteredArena(uint256 indexed tokenId, address indexed arena);
    event PhaseChanged(Phase phase);
    event PricesChanged(uint256 publicPrice, uint256 allowlistPrice);
    event WalletLimitsChanged(uint256 maxPerWallet, uint256 allowlistMaxPerWallet);
    event AllowlistRootChanged(bytes32 root);
    event RendererChanged(address renderer);
    event ArenaChanged(address arena);

    error SaleNotActive();
    error InvalidQuantity();
    error ExceedsMaxSupply();
    error ExceedsWalletLimit();
    error WrongPayment(uint256 expected);
    error NotOnAllowlist();
    error NotHolder(uint256 tokenId);
    error AlreadyRevealed(uint256 tokenId);
    error AlreadyOpened(uint256 tokenId);
    error RevealLocked(uint256 tokenId);
    error NoArena();
    error InvalidDecryptionProof(uint256 tokenId);
    error LengthMismatch();
    error ZeroAddress();
    error WithdrawFailed();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        address owner_,
        IFheCatRenderer renderer_,
        address royaltyReceiver,
        uint96 royaltyBps
    ) ERC721(name_, symbol_) Ownable(owner_) {
        if (address(renderer_) == address(0)) revert ZeroAddress();
        maxSupply = maxSupply_;
        renderer = renderer_;
        _setDefaultRoyalty(royaltyReceiver, royaltyBps);
    }

    // ---------------------------------------------------------------------
    // Minting
    // ---------------------------------------------------------------------

    modifier validQuantity(uint256 quantity) {
        if (quantity == 0 || quantity > MAX_PER_TX) revert InvalidQuantity();
        _;
    }

    function mint(uint256 quantity) external payable nonReentrant validQuantity(quantity) {
        if (phase != Phase.Public) revert SaleNotActive();
        uint256 minted = publicMinted[msg.sender] + quantity;
        if (maxPerWallet != 0 && minted > maxPerWallet) revert ExceedsWalletLimit();
        publicMinted[msg.sender] = minted;
        _charge(publicPrice, quantity);
        _mintCats(msg.sender, quantity);
    }

    /// @param proof Merkle proof for leaf keccak256(bytes.concat(keccak256(abi.encode(msg.sender))))
    ///              (OpenZeppelin StandardMerkleTree, leaf type ["address"]).
    function allowlistMint(uint256 quantity, bytes32[] calldata proof)
        external
        payable
        nonReentrant
        validQuantity(quantity)
    {
        if (phase != Phase.Allowlist) revert SaleNotActive();
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
        if (!MerkleProof.verifyCalldata(proof, allowlistRoot, leaf)) revert NotOnAllowlist();
        uint256 minted = allowlistMinted[msg.sender] + quantity;
        if (allowlistMaxPerWallet != 0 && minted > allowlistMaxPerWallet) revert ExceedsWalletLimit();
        allowlistMinted[msg.sender] = minted;
        _charge(allowlistPrice, quantity);
        _mintCats(msg.sender, quantity);
    }

    /// @notice Team reserve and airdrops. Ignores the sale phase and wallet limits.
    function ownerMint(address to, uint256 quantity) external onlyOwner nonReentrant validQuantity(quantity) {
        _mintCats(to, quantity);
    }

    function _charge(uint256 price, uint256 quantity) private {
        uint256 expected = price * quantity;
        if (msg.value != expected) revert WrongPayment(expected);
    }

    function _mintCats(address to, uint256 quantity) private {
        uint256 first = totalSupply + 1;
        uint256 last = totalSupply + quantity;
        if (last > maxSupply) revert ExceedsMaxSupply();
        totalSupply = last;

        for (uint256 tokenId = first; tokenId <= last; ++tokenId) {
            euint64 dna = _drawDna();
            // Only this contract may use the ciphertext: the cat is born unopened.
            FHE.allowThis(dna);
            _cats[tokenId].dna = dna;
            emit CatBorn(tokenId, to, euint64.unwrap(dna));
            _safeMint(to, tokenId);
        }
    }

    /// @dev Encrypted randomness from the CoFHE coprocessor. Overridden only by the local-dev mock.
    function _drawDna() internal virtual returns (euint64) {
        return FHE.randomEuint64();
    }

    // ---------------------------------------------------------------------
    // The box: peek, open, reveal
    // ---------------------------------------------------------------------

    /// @notice Take private decryption rights for your cat. Nobody else learns anything, but the
    ///         cat is marked Peeked for good, so later buyers know it may have been seen.
    function peek(uint256 tokenId) external {
        Cat storage cat = _holderCat(tokenId);
        if (cat.revealed) revert AlreadyRevealed(tokenId);
        if (cat.opened) revert AlreadyOpened(tokenId);
        FHE.allow(cat.dna, msg.sender);
        emit CatPeeked(tokenId, msg.sender);
        if (!cat.peeked) {
            cat.peeked = true;
            emit MetadataUpdate(tokenId);
        }
    }

    /// @notice Open the box: make the DNA publicly decryptable so anyone can finish the reveal.
    function open(uint256 tokenId) external {
        Cat storage cat = _holderCat(tokenId);
        if (cat.revealed) revert AlreadyRevealed(tokenId);
        if (cat.opened) revert AlreadyOpened(tokenId);
        cat.opened = true;
        FHE.allowPublic(cat.dna);
        emit CatOpened(tokenId, euint64.unwrap(cat.dna));
        emit MetadataUpdate(tokenId);
    }

    /// @notice Publish a cat's decrypted DNA.
    /// @param dna       plaintext DNA returned by the CoFHE threshold network (`decryptForTx`)
    /// @param signature the threshold network's signature over that decryption
    /// @dev The holder may reveal with their own decryption (after `peek`); anyone may once opened.
    function reveal(uint256 tokenId, uint64 dna, bytes calldata signature) external {
        _reveal(tokenId, dna, signature);
    }

    function revealBatch(uint256[] calldata tokenIds, uint64[] calldata dnas, bytes[] calldata signatures) external {
        if (tokenIds.length != dnas.length || tokenIds.length != signatures.length) revert LengthMismatch();
        for (uint256 i; i < tokenIds.length; ++i) {
            _reveal(tokenIds[i], dnas[i], signatures[i]);
        }
    }

    /// @notice Let the arena contract compute on this cat's encrypted DNA (duels, rarity proofs).
    ///         The arena is a contract, not a wallet: it can only publish what its code decides,
    ///         never the DNA itself. Grants stay with that arena address.
    function enterArena(uint256 tokenId) external {
        Cat storage cat = _holderCat(tokenId);
        address arena_ = arena;
        if (arena_ == address(0)) revert NoArena();
        FHE.allow(cat.dna, arena_);
        emit CatEnteredArena(tokenId, arena_);
    }

    function _holderCat(uint256 tokenId) private view returns (Cat storage) {
        if (_requireOwned(tokenId) != msg.sender) revert NotHolder(tokenId);
        return _cats[tokenId];
    }

    function _reveal(uint256 tokenId, uint64 dna, bytes calldata signature) private {
        address holder = _requireOwned(tokenId);
        Cat storage cat = _cats[tokenId];
        if (cat.revealed) revert AlreadyRevealed(tokenId);
        if (msg.sender != holder && !cat.opened) revert RevealLocked(tokenId);
        if (!FHE.verifyDecryptResultSafe(cat.dna, dna, signature)) revert InvalidDecryptionProof(tokenId);

        cat.revealed = true;
        cat.revealedDna = dna;
        emit CatRevealed(tokenId, dna);
        emit MetadataUpdate(tokenId);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Cat storage cat = _cats[tokenId];
        return renderer.tokenURI(tokenId, uint8(_state(cat)), cat.revealedDna, euint64.unwrap(cat.dna));
    }

    function stateOf(uint256 tokenId) external view returns (State) {
        _requireOwned(tokenId);
        return _state(_cats[tokenId]);
    }

    function _state(Cat storage cat) private view returns (State) {
        if (cat.revealed) return State.Revealed;
        if (cat.opened) return State.Opened;
        if (cat.peeked) return State.Peeked;
        return State.Unopened;
    }

    /// @notice Collection-level metadata (OpenSea `contractURI` convention).
    function contractURI() external view returns (string memory) {
        return renderer.contractURI();
    }

    function catOf(uint256 tokenId) public view returns (CatView memory) {
        address holder = _requireOwned(tokenId);
        Cat storage cat = _cats[tokenId];
        return CatView({
            tokenId: tokenId,
            owner: holder,
            dnaHandle: euint64.unwrap(cat.dna),
            state: _state(cat),
            peeked: cat.peeked,
            opened: cat.opened,
            revealed: cat.revealed,
            dna: cat.revealedDna
        });
    }

    /// @notice Every cat with an id in [fromId, toId] (clamped to minted ids).
    function catsInRange(uint256 fromId, uint256 toId) external view returns (CatView[] memory cats) {
        if (fromId == 0) fromId = 1;
        if (toId > totalSupply) toId = totalSupply;
        if (toId < fromId) return cats;
        cats = new CatView[](toId - fromId + 1);
        for (uint256 id = fromId; id <= toId; ++id) {
            cats[id - fromId] = catOf(id);
        }
    }

    /// @notice The cats `holder` owns with ids in [fromId, toId]. Paginate on big collections.
    function catsOfOwner(address holder, uint256 fromId, uint256 toId) external view returns (CatView[] memory cats) {
        if (fromId == 0) fromId = 1;
        if (toId > totalSupply) toId = totalSupply;
        uint256 balance = balanceOf(holder);
        cats = new CatView[](balance);
        uint256 found;
        for (uint256 id = fromId; id <= toId && found < balance; ++id) {
            if (_ownerOf(id) == holder) cats[found++] = catOf(id);
        }
        assembly {
            mstore(cats, found)
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(IERC165, ERC721, ERC2981)
        returns (bool)
    {
        return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setPhase(Phase newPhase) external onlyOwner {
        phase = newPhase;
        emit PhaseChanged(newPhase);
    }

    function setPrices(uint256 publicPrice_, uint256 allowlistPrice_) external onlyOwner {
        publicPrice = publicPrice_;
        allowlistPrice = allowlistPrice_;
        emit PricesChanged(publicPrice_, allowlistPrice_);
    }

    function setWalletLimits(uint256 maxPerWallet_, uint256 allowlistMaxPerWallet_) external onlyOwner {
        maxPerWallet = maxPerWallet_;
        allowlistMaxPerWallet = allowlistMaxPerWallet_;
        emit WalletLimitsChanged(maxPerWallet_, allowlistMaxPerWallet_);
    }

    function setAllowlistRoot(bytes32 root) external onlyOwner {
        allowlistRoot = root;
        emit AllowlistRootChanged(root);
    }

    function setRenderer(IFheCatRenderer renderer_) external onlyOwner {
        if (address(renderer_) == address(0)) revert ZeroAddress();
        renderer = renderer_;
        emit RendererChanged(address(renderer_));
        if (totalSupply != 0) emit BatchMetadataUpdate(1, totalSupply);
    }

    function setArena(address arena_) external onlyOwner {
        arena = arena_;
        emit ArenaChanged(arena_);
    }

    function setDefaultRoyalty(address receiver, uint96 bps) external onlyOwner {
        _setDefaultRoyalty(receiver, bps);
    }

    function withdraw(address payable to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }
}
