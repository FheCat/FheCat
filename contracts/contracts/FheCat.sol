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
/// @notice Pixel cats whose DNA is born encrypted on Fhenix CoFHE.
///
/// Every mint draws a 64-bit DNA with `FHE.randomEuint64()`. The value only
/// exists as a ciphertext, so nobody - the team, the minter, a sniping bot - can
/// know a cat's traits at mint time. The contract and the current holder are on
/// the ciphertext's ACL, which lets the holder decrypt it privately off-chain
/// ("peek"). Revealing publishes the plaintext on-chain, authenticated by the
/// CoFHE threshold network's decryption signature.
///
/// Who can reveal:
///  - the holder, any time, with a decryption obtained through their own permit;
///  - anyone, once public decryption is enabled for the token - by its holder, or
///    by anyone after the collection-wide `grandRevealAt` time.
contract FheCat is IERC4906, ERC721, ERC2981, Ownable2Step, ReentrancyGuard {
    enum Phase {
        Closed,
        Allowlist,
        Public
    }

    struct Cat {
        euint64 dna;
        uint64 revealedDna;
        bool revealed;
        bool publicDecryption;
    }

    struct CatView {
        uint256 tokenId;
        address owner;
        bytes32 dnaHandle;
        bool revealed;
        bool publicDecryption;
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
    /// @notice After this timestamp anyone may enable public decryption of any cat. 0 = not scheduled.
    uint64 public grandRevealAt;

    IFheCatRenderer public renderer;

    mapping(uint256 tokenId => Cat) private _cats;
    mapping(address minter => uint256) public publicMinted;
    mapping(address minter => uint256) public allowlistMinted;

    event CatBorn(uint256 indexed tokenId, address indexed to, bytes32 dnaHandle);
    event CatRevealed(uint256 indexed tokenId, uint64 dna);
    event PublicDecryptionEnabled(uint256 indexed tokenId, bytes32 dnaHandle);
    event PhaseChanged(Phase phase);
    event PricesChanged(uint256 publicPrice, uint256 allowlistPrice);
    event WalletLimitsChanged(uint256 maxPerWallet, uint256 allowlistMaxPerWallet);
    event AllowlistRootChanged(bytes32 root);
    event GrandRevealScheduled(uint64 timestamp);
    event RendererChanged(address renderer);

    error SaleNotActive();
    error InvalidQuantity();
    error ExceedsMaxSupply();
    error ExceedsWalletLimit();
    error WrongPayment(uint256 expected);
    error NotOnAllowlist();
    error AlreadyRevealed(uint256 tokenId);
    error RevealLocked(uint256 tokenId);
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
            FHE.allowThis(dna);
            _cats[tokenId].dna = dna;
            emit CatBorn(tokenId, to, euint64.unwrap(dna));
            // _update grants `to` access to the ciphertext.
            _safeMint(to, tokenId);
        }
    }

    /// @dev Encrypted randomness from the CoFHE coprocessor. Overridden only by the local-dev mock.
    function _drawDna() internal virtual returns (euint64) {
        return FHE.randomEuint64();
    }

    /// @dev Every new holder of a still-encrypted cat is added to the ciphertext's ACL
    ///      so they can peek at it. (ACL grants are permanent: earlier holders keep theirs.)
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (to != address(0)) {
            Cat storage cat = _cats[tokenId];
            if (!cat.revealed) FHE.allow(cat.dna, to);
        }
    }

    // ---------------------------------------------------------------------
    // Reveal
    // ---------------------------------------------------------------------

    /// @notice Publish a cat's decrypted DNA.
    /// @param dna       plaintext DNA returned by the CoFHE threshold network (`decryptForTx`)
    /// @param signature the threshold network's signature over that decryption
    function reveal(uint256 tokenId, uint64 dna, bytes calldata signature) external {
        _reveal(tokenId, dna, signature);
    }

    function revealBatch(uint256[] calldata tokenIds, uint64[] calldata dnas, bytes[] calldata signatures) external {
        if (tokenIds.length != dnas.length || tokenIds.length != signatures.length) revert LengthMismatch();
        for (uint256 i; i < tokenIds.length; ++i) {
            _reveal(tokenIds[i], dnas[i], signatures[i]);
        }
    }

    /// @notice Let anyone decrypt this cat's DNA (FHE.allowPublic), so anyone can finish its reveal.
    ///         The holder may do this at any time; everyone else only after `grandRevealAt`.
    function enablePublicDecryption(uint256 tokenId) external {
        _enablePublicDecryption(tokenId, true);
    }

    /// @notice Batch form for the grand reveal. Skips cats that are already revealed or public.
    function enablePublicDecryptionBatch(uint256[] calldata tokenIds) external {
        for (uint256 i; i < tokenIds.length; ++i) {
            _enablePublicDecryption(tokenIds[i], false);
        }
    }

    function grandRevealStarted() public view returns (bool) {
        return grandRevealAt != 0 && block.timestamp >= grandRevealAt;
    }

    function _reveal(uint256 tokenId, uint64 dna, bytes calldata signature) private {
        address holder = _requireOwned(tokenId);
        Cat storage cat = _cats[tokenId];
        if (cat.revealed) revert AlreadyRevealed(tokenId);
        if (msg.sender != holder && !cat.publicDecryption) revert RevealLocked(tokenId);
        if (!FHE.verifyDecryptResultSafe(cat.dna, dna, signature)) revert InvalidDecryptionProof(tokenId);

        cat.revealed = true;
        cat.revealedDna = dna;
        emit CatRevealed(tokenId, dna);
        emit MetadataUpdate(tokenId);
    }

    function _enablePublicDecryption(uint256 tokenId, bool strict) private {
        address holder = _requireOwned(tokenId);
        Cat storage cat = _cats[tokenId];
        if (cat.revealed || cat.publicDecryption) {
            if (strict && cat.revealed) revert AlreadyRevealed(tokenId);
            return;
        }
        if (msg.sender != holder && !grandRevealStarted()) revert RevealLocked(tokenId);

        cat.publicDecryption = true;
        FHE.allowPublic(cat.dna);
        emit PublicDecryptionEnabled(tokenId, euint64.unwrap(cat.dna));
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Cat storage cat = _cats[tokenId];
        return renderer.tokenURI(tokenId, cat.revealed, cat.revealedDna, euint64.unwrap(cat.dna));
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
            revealed: cat.revealed,
            publicDecryption: cat.publicDecryption,
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

    function setGrandRevealAt(uint64 timestamp) external onlyOwner {
        grandRevealAt = timestamp;
        emit GrandRevealScheduled(timestamp);
    }

    function setRenderer(IFheCatRenderer renderer_) external onlyOwner {
        if (address(renderer_) == address(0)) revert ZeroAddress();
        renderer = renderer_;
        emit RendererChanged(address(renderer_));
        if (totalSupply != 0) emit BatchMetadataUpdate(1, totalSupply);
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
