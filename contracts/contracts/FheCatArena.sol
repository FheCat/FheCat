// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, ebool, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {FheCat} from "./FheCat.sol";

/// @title FheCatArena
/// @notice Blind duels and power tiers for FheCats, computed on their encrypted DNA.
///
/// A cat's Power is the sum of its eight DNA bytes (0-2040). Every trait table lists its
/// options from most common to rarest, so a rarer trait always means as much power or more.
/// The arena computes Power under FHE and never decrypts it. The only thing that ever
/// becomes public is the one bit a holder asked for: who won a duel, or whether a cat
/// reaches a tier. The DNA, the traits and the Power itself stay sealed, so a cat can
/// fight while still Unopened.
///
/// To play, a holder first calls `FheCat.enterArena(tokenId)`, which lets this contract
/// compute on the cat's ciphertext. Only a cat's current holder can open a duel, accept
/// one or claim a tier with it. Results are decrypted by the CoFHE threshold network and
/// anyone can settle them on-chain with its signature. There is nothing at stake but glory.
contract FheCatArena {
    enum DuelStatus {
        None,
        Open,
        Fought,
        Settled,
        Cancelled
    }

    struct Duel {
        uint256 challenger;
        /// @dev 0 while an open duel waits for any cat to accept.
        uint256 opponent;
        /// @dev Encrypted `challenger power > opponent power`; ties go to the opponent.
        ebool challengerWins;
        DuelStatus status;
        uint256 winner;
    }

    struct Claim {
        uint256 tokenId;
        uint8 tier;
        /// @dev Encrypted `power >= tier threshold`.
        ebool reached;
        bool settled;
        bool result;
    }

    struct Record {
        uint32 wins;
        uint32 losses;
        /// @dev Highest tier proven so far (0 = none).
        uint8 tier;
    }

    /// @notice Power needed for tiers 1-4 (Rare, Epic, Legendary, Mythic): roughly the top
    ///         20%, 6%, 1% and 0.2% of random cats.
    uint64 public constant RARE = 1200;
    uint64 public constant EPIC = 1350;
    uint64 public constant LEGENDARY = 1500;
    uint64 public constant MYTHIC = 1600;

    FheCat public immutable cats;

    uint256 public duelCount;
    uint256 public claimCount;
    mapping(uint256 duelId => Duel) public duels;
    mapping(uint256 claimId => Claim) public claims;
    mapping(uint256 tokenId => Record) public records;

    mapping(uint256 tokenId => euint64) private _power;
    /// @dev Trivially encrypted public constants, made once and reused.
    mapping(uint64 value => euint64) private _consts;

    event PowerSealed(uint256 indexed tokenId, bytes32 powerHandle);
    event DuelOpened(uint256 indexed duelId, uint256 indexed challenger, uint256 indexed opponent);
    event DuelFought(uint256 indexed duelId, uint256 challenger, uint256 opponent, bytes32 outcomeHandle);
    event DuelSettled(uint256 indexed duelId, uint256 indexed winner, uint256 indexed loser);
    event DuelCancelled(uint256 indexed duelId);
    event TierClaimed(uint256 indexed claimId, uint256 indexed tokenId, uint8 tier, bytes32 resultHandle);
    event TierSettled(uint256 indexed claimId, uint256 indexed tokenId, uint8 tier, bool reached);

    error NotHolder(uint256 tokenId);
    error NotInArena(uint256 tokenId);
    error SameCat();
    error DuelNotOpen(uint256 duelId);
    error DuelNotFought(uint256 duelId);
    error NotChallenged(uint256 duelId, uint256 tokenId);
    error InvalidTier(uint8 tier);
    error UnknownClaim(uint256 claimId);
    error AlreadySettled(uint256 claimId);
    error InvalidDecryptionProof();

    constructor(FheCat cats_) {
        cats = cats_;
    }

    // ---------------------------------------------------------------------
    // Duels
    // ---------------------------------------------------------------------

    /// @notice Challenge another cat, or anyone (`opponent` = 0). Seals your cat's power now.
    function challenge(uint256 tokenId, uint256 opponent) external returns (uint256 duelId) {
        _requireHolder(tokenId);
        if (opponent == tokenId) revert SameCat();
        if (opponent != 0) cats.ownerOf(opponent); // must exist
        _powerOf(tokenId);
        duelId = ++duelCount;
        Duel storage d = duels[duelId];
        d.challenger = tokenId;
        d.opponent = opponent;
        d.status = DuelStatus.Open;
        emit DuelOpened(duelId, tokenId, opponent);
    }

    /// @notice Accept a duel with one of your cats. The outcome is computed encrypted and made
    ///         publicly decryptable; nothing else about either cat is.
    function accept(uint256 duelId, uint256 tokenId) external {
        Duel storage d = duels[duelId];
        if (d.status != DuelStatus.Open) revert DuelNotOpen(duelId);
        if (d.opponent != 0 && d.opponent != tokenId) revert NotChallenged(duelId, tokenId);
        if (tokenId == d.challenger) revert SameCat();
        _requireHolder(tokenId);

        ebool wins = FHE.gt(_powerOf(d.challenger), _powerOf(tokenId));
        FHE.allowThis(wins);
        FHE.allowPublic(wins);
        d.opponent = tokenId;
        d.challengerWins = wins;
        d.status = DuelStatus.Fought;
        emit DuelFought(duelId, d.challenger, tokenId, ebool.unwrap(wins));
    }

    /// @notice Publish a fought duel's result with the threshold network's decryption proof.
    function settle(uint256 duelId, bool challengerWon, bytes calldata signature) external {
        Duel storage d = duels[duelId];
        if (d.status != DuelStatus.Fought) revert DuelNotFought(duelId);
        if (!FHE.verifyDecryptResultSafe(d.challengerWins, challengerWon, signature)) {
            revert InvalidDecryptionProof();
        }
        (uint256 winner, uint256 loser) = challengerWon ? (d.challenger, d.opponent) : (d.opponent, d.challenger);
        d.status = DuelStatus.Settled;
        d.winner = winner;
        ++records[winner].wins;
        ++records[loser].losses;
        emit DuelSettled(duelId, winner, loser);
    }

    /// @notice Withdraw a duel nobody has accepted yet. Only the challenging cat's holder can.
    function cancel(uint256 duelId) external {
        Duel storage d = duels[duelId];
        if (d.status != DuelStatus.Open) revert DuelNotOpen(duelId);
        _requireHolder(d.challenger);
        d.status = DuelStatus.Cancelled;
        emit DuelCancelled(duelId);
    }

    // ---------------------------------------------------------------------
    // Tiers
    // ---------------------------------------------------------------------

    /// @notice Ask the arena to prove your cat reaches a tier (1 Rare ... 4 Mythic) without
    ///         revealing it. The yes/no answer becomes public, whichever it is.
    function claimTier(uint256 tokenId, uint8 tier) external returns (uint256 claimId) {
        uint64 threshold = tierThreshold(tier);
        _requireHolder(tokenId);
        ebool reached = FHE.gte(_powerOf(tokenId), _const(threshold));
        FHE.allowThis(reached);
        FHE.allowPublic(reached);
        claimId = ++claimCount;
        claims[claimId] = Claim({tokenId: tokenId, tier: tier, reached: reached, settled: false, result: false});
        emit TierClaimed(claimId, tokenId, tier, ebool.unwrap(reached));
    }

    /// @notice Publish a tier claim's answer with the threshold network's decryption proof.
    function settleTier(uint256 claimId, bool reached, bytes calldata signature) external {
        Claim storage c = claims[claimId];
        if (c.tokenId == 0) revert UnknownClaim(claimId);
        if (c.settled) revert AlreadySettled(claimId);
        if (!FHE.verifyDecryptResultSafe(c.reached, reached, signature)) revert InvalidDecryptionProof();
        c.settled = true;
        c.result = reached;
        Record storage r = records[c.tokenId];
        if (reached && c.tier > r.tier) r.tier = c.tier;
        emit TierSettled(claimId, c.tokenId, c.tier, reached);
    }

    function tierThreshold(uint8 tier) public pure returns (uint64) {
        if (tier == 1) return RARE;
        if (tier == 2) return EPIC;
        if (tier == 3) return LEGENDARY;
        if (tier == 4) return MYTHIC;
        revert InvalidTier(tier);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice The ciphertext handle of a cat's sealed power (0 until it first plays).
    ///         Nobody is allowed to decrypt it, the arena included.
    function powerHandle(uint256 tokenId) external view returns (bytes32) {
        return euint64.unwrap(_power[tokenId]);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _requireHolder(uint256 tokenId) private view {
        if (cats.ownerOf(tokenId) != msg.sender) revert NotHolder(tokenId);
    }

    /// @dev Power = sum of the DNA's eight bytes, folded pairwise (SWAR): 11 FHE ops, once per cat.
    function _powerOf(uint256 tokenId) private returns (euint64 power) {
        power = _power[tokenId];
        if (euint64.unwrap(power) != bytes32(0)) return power;

        euint64 dna = euint64.wrap(cats.catOf(tokenId).dnaHandle);
        if (!FHE.isAllowed(dna, address(this))) revert NotInArena(tokenId);

        euint64 m8 = _const(0x00FF00FF00FF00FF);
        euint64 m16 = _const(0x0000FFFF0000FFFF);
        euint64 x = FHE.add(FHE.and(dna, m8), FHE.and(FHE.shr(dna, _const(8)), m8));
        x = FHE.add(FHE.and(x, m16), FHE.and(FHE.shr(x, _const(16)), m16));
        power = FHE.add(FHE.and(x, _const(0xFFFFFFFF)), FHE.shr(x, _const(32)));

        FHE.allowThis(power);
        _power[tokenId] = power;
        emit PowerSealed(tokenId, euint64.unwrap(power));
    }

    function _const(uint64 value) private returns (euint64 c) {
        c = _consts[value];
        if (euint64.unwrap(c) == bytes32(0)) {
            c = FHE.asEuint64(value);
            FHE.allowThis(c);
            _consts[value] = c;
        }
    }
}
