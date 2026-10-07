// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, ebool, euint8, euint64, externalEuint8} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {FheCat} from "./FheCat.sol";

/// @title FheCatArena: the Blind Arena
/// @notice Duels between cats that nobody may ever have seen, their holders included.
///
/// Each side locks one of three tactics, encrypted in the browser, so nobody sees it: Pounce
/// beats Trick, Trick beats Guard, Guard beats Pounce. Each cat also has hidden instincts,
/// worked out under FHE from its DNA: a rare Pattern and rare Eyes sharpen its Pounce, a rare
/// Mouth and Headwear its Trick, a rare Accessory and Aura its Guard (0 to 2 each). Under FHE,
/// each side scores
///
///     2 if its tactic beats the other's, + its instinct for the tactic it chose, + luck (0 or 1)
///
/// and the higher score wins. A tie goes to a sealed box (a cat nobody has opened or peeked at);
/// between two sealed or two unsealed boxes, a coin decides. Only the winner ever becomes public.
/// The DNA, the instincts, the tactics and the scores stay encrypted. After the fight each holder
/// can decrypt the other side's tactic, and nobody else can.
///
/// Every duel feeds a weekly table (a win is 3 points, 4 with a sealed box; a loss is 1) and
/// badges that stay with the cat. Two cats meet at most once a week, so no one can probe a cat
/// over and over. Holders can also prove a power tier (the sum of the DNA bytes) without
/// revealing anything else.
///
/// To play, a holder first calls `FheCat.enterArena(tokenId)`, which lets this contract compute
/// on the cat's ciphertext. There is nothing at stake but glory.
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
        address challengerHolder;
        address opponentHolder;
        /// @dev 0 Pounce, 1 Trick, 2 Guard (anything else counts as Pounce). Encrypted for good.
        euint8 challengerTactic;
        euint8 opponentTactic;
        /// @dev Encrypted 1 (challenger won) or 2 (opponent won), made public once fought.
        euint64 outcome;
        uint64 openedAt;
        uint64 foughtAt;
        DuelStatus status;
        /// @dev Whether each box was Unopened (never peeked or opened) when the duel was fought.
        bool challengerSealed;
        bool opponentSealed;
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
        /// @dev Wins while the box was still Unopened.
        uint32 sealedWins;
        uint16 streak;
        uint16 bestStreak;
        /// @dev Highest tier proven so far (0 = none).
        uint8 tier;
        uint32 badges;
    }

    // Tactics, and the RPS table: entry 3*a+b holds a's points (bits 0-1) and b's (bits 2-3).
    uint8 public constant POUNCE = 0;
    uint8 public constant TRICK = 1;
    uint8 public constant GUARD = 2;
    uint64 private constant RPS_TABLE = 0x82208820;

    // Instincts: DNA bytes in 16-bit lanes. Lane 1 = Pattern+Eyes (Pounce), 2 = Mouth+Headwear
    // (Trick), 3 = Accessory+Aura (Guard). A trait counts when its byte reaches the option where
    // its rarer half starts: Pattern 126 (Spots), Eyes 120 (Sleepy), Mouth 116 (Fang), Headwear
    // 130 (Bow), Accessory 132 (Bandana), Aura 154 (any aura). Adding 256 - threshold to a lane
    // carries into its bit 8 exactly when the byte reaches the threshold.
    uint64 private constant EVEN_BYTES = 0x00FF00FF00FF00FF;
    uint64 private constant LOW_BITS = 0x0001000100010001;
    uint64 private constant EVEN_BIAS = (uint64(256 - 132) << 48) | (uint64(256 - 116) << 32) | (uint64(256 - 126) << 16);
    uint64 private constant ODD_BIAS = (uint64(256 - 154) << 48) | (uint64(256 - 130) << 32) | (uint64(256 - 120) << 16);

    /// @notice Weekly table points.
    uint32 public constant WIN_POINTS = 3;
    uint32 public constant SEALED_WIN_POINTS = 4;
    uint32 public constant LOSS_POINTS = 1;

    /// @notice Badge bits in `Record.badges`.
    uint32 public constant FIRST_WIN = 1 << 0;
    uint32 public constant SEALED_WIN = 1 << 1;
    uint32 public constant HAT_TRICK = 1 << 2;
    uint32 public constant SEALED_LEGEND = 1 << 3;
    uint32 public constant WEEKLY_CROWN = 1 << 4;
    uint32 public constant SEALED_LEGEND_WINS = 5;

    /// @notice Weeks run Monday 00:00 UTC to Monday (1970-01-05 was a Monday).
    uint256 public constant WEEK = 7 days;
    uint256 public constant WEEK_ANCHOR = 4 days;
    /// @notice A week's crown waits this long after the week ends, for late settlements.
    uint256 public constant CROWN_GRACE = 1 days;
    /// @notice How long a challenge stays open.
    uint256 public constant OPEN_FOR = 3 days;

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
    /// @notice The challenge a cat has open, if any (0 = none).
    mapping(uint256 tokenId => uint256 duelId) public openDuelOf;

    mapping(uint256 week => mapping(uint256 tokenId => uint32)) public weeklyPoints;
    /// @notice The cat with the most points this week so far (the first to get there on a tie).
    mapping(uint256 week => uint256 tokenId) public weeklyLeader;
    /// @notice The cat crowned for a week once it is over (0 until then).
    mapping(uint256 week => uint256 tokenId) public weeklyChampion;

    mapping(uint256 tokenId => euint64) private _instincts;
    mapping(uint256 tokenId => euint64) private _power;
    /// @dev Trivially encrypted public constants, made once and reused.
    mapping(uint64 value => euint64) private _consts;
    mapping(bytes32 pairWeek => bool) private _met;

    event InstinctsSealed(uint256 indexed tokenId, bytes32 handle);
    event PowerSealed(uint256 indexed tokenId, bytes32 powerHandle);
    event DuelOpened(uint256 indexed duelId, uint256 indexed challenger, uint256 indexed opponent);
    event DuelFought(uint256 indexed duelId, uint256 challenger, uint256 opponent, bytes32 outcomeHandle);
    event DuelSettled(uint256 indexed duelId, uint256 indexed winner, uint256 indexed loser, uint256 week, bool sealedWin);
    event DuelCancelled(uint256 indexed duelId);
    event BadgeEarned(uint256 indexed tokenId, uint32 badge);
    event WeekCrowned(uint256 indexed week, uint256 indexed tokenId, uint32 points);
    event TierClaimed(uint256 indexed claimId, uint256 indexed tokenId, uint8 tier, bytes32 resultHandle);
    event TierSettled(uint256 indexed claimId, uint256 indexed tokenId, uint8 tier, bool reached);

    error NotHolder(uint256 tokenId);
    error NotInArena(uint256 tokenId);
    error SameCat();
    error SameHolder();
    error AlreadyChallenging(uint256 duelId);
    error AlreadyMetThisWeek();
    error DuelNotOpen(uint256 duelId);
    error DuelExpired(uint256 duelId);
    error DuelNotFought(uint256 duelId);
    error NotChallenged(uint256 duelId, uint256 tokenId);
    error ChallengerMoved(uint256 duelId);
    error WeekNotOver(uint256 week);
    error AlreadyCrowned(uint256 week);
    error NoLeader(uint256 week);
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

    /// @notice Challenge another cat, or anyone (`opponent` = 0), with an encrypted tactic.
    /// @param tactic encrypted 0 (Pounce), 1 (Trick) or 2 (Guard), made for this contract and caller
    /// @param proof  the CoFHE verifier's signature over it
    function challenge(uint256 tokenId, uint256 opponent, externalEuint8 tactic, bytes calldata proof)
        external
        returns (uint256 duelId)
    {
        _requireHolder(tokenId);
        if (opponent == tokenId) revert SameCat();
        if (opponent != 0) {
            if (cats.ownerOf(opponent) == msg.sender) revert SameHolder();
            if (_met[_pairKey(currentWeek(), tokenId, opponent)]) revert AlreadyMetThisWeek();
        }
        uint256 open = openDuelOf[tokenId];
        if (open != 0 && isOpen(open)) revert AlreadyChallenging(open);
        _instinctsOf(tokenId);

        euint8 locked = FHE.asEuint8(tactic, proof);
        FHE.allowThis(locked);
        FHE.allow(locked, msg.sender);

        duelId = ++duelCount;
        Duel storage d = duels[duelId];
        d.challenger = tokenId;
        d.opponent = opponent;
        d.challengerHolder = msg.sender;
        d.challengerTactic = locked;
        d.openedAt = uint64(block.timestamp);
        d.status = DuelStatus.Open;
        openDuelOf[tokenId] = duelId;
        emit DuelOpened(duelId, tokenId, opponent);
    }

    /// @notice Take a challenge with one of your cats and your own encrypted tactic. The duel is
    ///         fought on the spot, under FHE; only its outcome becomes publicly decryptable.
    function accept(uint256 duelId, uint256 tokenId, externalEuint8 tactic, bytes calldata proof) external {
        Duel storage d = duels[duelId];
        if (d.status != DuelStatus.Open) revert DuelNotOpen(duelId);
        if (block.timestamp > d.openedAt + OPEN_FOR) revert DuelExpired(duelId);
        if (d.opponent != 0 && d.opponent != tokenId) revert NotChallenged(duelId, tokenId);
        if (tokenId == d.challenger) revert SameCat();
        _requireHolder(tokenId);
        address challengerHolder = d.challengerHolder;
        if (cats.ownerOf(d.challenger) != challengerHolder) revert ChallengerMoved(duelId);
        if (challengerHolder == msg.sender) revert SameHolder();
        bytes32 pair = _pairKey(currentWeek(), d.challenger, tokenId);
        if (_met[pair]) revert AlreadyMetThisWeek();
        _met[pair] = true;

        euint8 locked = FHE.asEuint8(tactic, proof);
        // Each side may look at both tactics once the fight is done; nobody else ever can.
        FHE.allow(locked, msg.sender);
        FHE.allow(locked, challengerHolder);
        FHE.allow(d.challengerTactic, msg.sender);

        bool challengerSealed = _isSealed(d.challenger);
        bool opponentSealed = _isSealed(tokenId);
        euint64 outcome = _fight(d.challenger, tokenId, d.challengerTactic, locked, challengerSealed, opponentSealed);
        FHE.allowThis(outcome);
        FHE.allowPublic(outcome);

        d.opponent = tokenId;
        d.opponentHolder = msg.sender;
        d.opponentTactic = locked;
        d.outcome = outcome;
        d.foughtAt = uint64(block.timestamp);
        d.status = DuelStatus.Fought;
        d.challengerSealed = challengerSealed;
        d.opponentSealed = opponentSealed;
        if (openDuelOf[d.challenger] == duelId) openDuelOf[d.challenger] = 0;
        emit DuelFought(duelId, d.challenger, tokenId, euint64.unwrap(outcome));
    }

    /// @notice Publish a fought duel's outcome (1 challenger, 2 opponent) with the CoFHE
    ///         decryption proof. Anyone can; it scores the week and hands out badges.
    function settle(uint256 duelId, uint8 outcome, bytes calldata signature) external {
        Duel storage d = duels[duelId];
        if (d.status != DuelStatus.Fought) revert DuelNotFought(duelId);
        if (!FHE.verifyDecryptResultSafe(d.outcome, uint64(outcome), signature)) revert InvalidDecryptionProof();

        bool challengerWon = outcome == 1;
        (uint256 winner, uint256 loser) = challengerWon ? (d.challenger, d.opponent) : (d.opponent, d.challenger);
        bool sealedWin = challengerWon ? d.challengerSealed : d.opponentSealed;
        d.status = DuelStatus.Settled;
        d.winner = winner;

        uint256 week = weekOf(d.foughtAt);
        _scoreWin(winner, week, sealedWin);
        _scoreLoss(loser, week);
        emit DuelSettled(duelId, winner, loser, week, sealedWin);
        _crownLastWeek();
    }

    /// @notice Withdraw a challenge nobody has taken yet. Only the challenging cat's holder can.
    function cancel(uint256 duelId) external {
        Duel storage d = duels[duelId];
        if (d.status != DuelStatus.Open) revert DuelNotOpen(duelId);
        _requireHolder(d.challenger);
        d.status = DuelStatus.Cancelled;
        if (openDuelOf[d.challenger] == duelId) openDuelOf[d.challenger] = 0;
        emit DuelCancelled(duelId);
    }

    // ---------------------------------------------------------------------
    // The weekly table
    // ---------------------------------------------------------------------

    function weekOf(uint256 timestamp) public pure returns (uint256) {
        return (timestamp - WEEK_ANCHOR) / WEEK;
    }

    function currentWeek() public view returns (uint256) {
        return weekOf(block.timestamp);
    }

    function weekStart(uint256 week) public pure returns (uint256) {
        return WEEK_ANCHOR + week * WEEK;
    }

    /// @notice Crown a finished week's leader with the Weekly Crown badge. Anyone can, once a day
    ///         has passed since the week ended; settling a duel does it for the week before.
    function crownWeek(uint256 week) public {
        if (block.timestamp < weekStart(week + 1) + CROWN_GRACE) revert WeekNotOver(week);
        if (weeklyChampion[week] != 0) revert AlreadyCrowned(week);
        uint256 leader = weeklyLeader[week];
        if (leader == 0) revert NoLeader(week);
        weeklyChampion[week] = leader;
        _badge(leader, WEEKLY_CROWN);
        emit WeekCrowned(week, leader, weeklyPoints[week][leader]);
    }

    function _crownLastWeek() private {
        uint256 week = currentWeek();
        if (week == 0) return;
        uint256 last = week - 1;
        if (
            weeklyChampion[last] == 0 && weeklyLeader[last] != 0 && block.timestamp >= weekStart(week) + CROWN_GRACE
        ) crownWeek(last);
    }

    function _scoreWin(uint256 tokenId, uint256 week, bool sealedWin) private {
        Record storage r = records[tokenId];
        ++r.wins;
        if (sealedWin) ++r.sealedWins;
        if (r.streak < type(uint16).max) ++r.streak;
        if (r.streak > r.bestStreak) r.bestStreak = r.streak;
        _addPoints(week, tokenId, sealedWin ? SEALED_WIN_POINTS : WIN_POINTS);
        if (r.wins == 1) _badge(tokenId, FIRST_WIN);
        if (sealedWin) _badge(tokenId, SEALED_WIN);
        if (r.streak >= 3) _badge(tokenId, HAT_TRICK);
        if (r.sealedWins >= SEALED_LEGEND_WINS) _badge(tokenId, SEALED_LEGEND);
    }

    function _scoreLoss(uint256 tokenId, uint256 week) private {
        Record storage r = records[tokenId];
        ++r.losses;
        r.streak = 0;
        _addPoints(week, tokenId, LOSS_POINTS);
    }

    function _addPoints(uint256 week, uint256 tokenId, uint32 points) private {
        uint32 total = weeklyPoints[week][tokenId] + points;
        weeklyPoints[week][tokenId] = total;
        uint256 leader = weeklyLeader[week];
        if (leader == 0 || (leader != tokenId && total > weeklyPoints[week][leader])) weeklyLeader[week] = tokenId;
    }

    function _badge(uint256 tokenId, uint32 badge) private {
        Record storage r = records[tokenId];
        if (r.badges & badge != 0) return;
        r.badges |= badge;
        emit BadgeEarned(tokenId, badge);
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

    /// @notice Publish a tier claim's answer with the CoFHE decryption proof.
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

    /// @notice Whether a challenge can still be taken.
    function isOpen(uint256 duelId) public view returns (bool) {
        Duel storage d = duels[duelId];
        return d.status == DuelStatus.Open && block.timestamp <= d.openedAt + OPEN_FOR;
    }

    /// @notice Duels with ids in [fromId, toId], clamped to existing ones.
    function duelsInRange(uint256 fromId, uint256 toId) external view returns (Duel[] memory list) {
        if (fromId == 0) fromId = 1;
        if (toId > duelCount) toId = duelCount;
        if (toId < fromId) return list;
        list = new Duel[](toId - fromId + 1);
        for (uint256 id = fromId; id <= toId; ++id) list[id - fromId] = duels[id];
    }

    /// @notice Records and this week's points for cats with ids in [fromId, toId].
    function standings(uint256 week, uint256 fromId, uint256 toId)
        external
        view
        returns (Record[] memory recs, uint32[] memory points)
    {
        if (fromId == 0) fromId = 1;
        uint256 supply = cats.totalSupply();
        if (toId > supply) toId = supply;
        if (toId < fromId) return (recs, points);
        recs = new Record[](toId - fromId + 1);
        points = new uint32[](toId - fromId + 1);
        for (uint256 id = fromId; id <= toId; ++id) {
            recs[id - fromId] = records[id];
            points[id - fromId] = weeklyPoints[week][id];
        }
    }

    /// @notice The ciphertext of a cat's sealed instincts (0 until it first plays). Nobody may decrypt it.
    function instinctsHandle(uint256 tokenId) external view returns (bytes32) {
        return euint64.unwrap(_instincts[tokenId]);
    }

    /// @notice The ciphertext of a cat's sealed power (0 until it first claims a tier). Nobody may decrypt it.
    function powerHandle(uint256 tokenId) external view returns (bytes32) {
        return euint64.unwrap(_power[tokenId]);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _requireHolder(uint256 tokenId) private view {
        if (cats.ownerOf(tokenId) != msg.sender) revert NotHolder(tokenId);
    }

    function _isSealed(uint256 tokenId) private view returns (bool) {
        return cats.stateOf(tokenId) == FheCat.State.Unopened;
    }

    function _pairKey(uint256 week, uint256 a, uint256 b) private pure returns (bytes32) {
        return a < b ? keccak256(abi.encode(week, a, b)) : keccak256(abi.encode(week, b, a));
    }

    function _dnaOf(uint256 tokenId) private view returns (euint64 dna) {
        dna = euint64.wrap(cats.catOf(tokenId).dnaHandle);
        if (!FHE.isAllowed(dna, address(this))) revert NotInArena(tokenId);
    }

    /// @dev The three instincts in lanes 1-3 of one ciphertext (SWAR): 10 FHE ops, once per cat.
    function _instinctsOf(uint256 tokenId) private returns (euint64 pack) {
        pack = _instincts[tokenId];
        if (euint64.unwrap(pack) != bytes32(0)) return pack;
        euint64 dna = _dnaOf(tokenId);
        euint64 evenBytes = _const(EVEN_BYTES);
        euint64 eight = _const(8);
        euint64 lowBits = _const(LOW_BITS);
        euint64 even = FHE.add(FHE.and(dna, evenBytes), _const(EVEN_BIAS));
        euint64 odd = FHE.add(FHE.and(FHE.shr(dna, eight), evenBytes), _const(ODD_BIAS));
        pack = FHE.add(FHE.and(FHE.shr(even, eight), lowBits), FHE.and(FHE.shr(odd, eight), lowBits));
        FHE.allowThis(pack);
        _instincts[tokenId] = pack;
        emit InstinctsSealed(tokenId, euint64.unwrap(pack));
    }

    /// @dev Both scores and the outcome under FHE: 1 if the challenger wins, 2 if the opponent does.
    function _fight(
        uint256 challenger,
        uint256 opponent,
        euint8 challengerTactic,
        euint8 opponentTactic,
        bool challengerSealed,
        bool opponentSealed
    ) private returns (euint64) {
        euint64 a = _tactic(challengerTactic);
        euint64 b = _tactic(opponentTactic);
        (euint64 rpsA, euint64 rpsB) = _rps(a, b);
        euint64 luck = _drawLuck();
        euint64 scoreA = _score(rpsA, _instinctFor(challenger, a), luck, 0);
        euint64 scoreB = _score(rpsB, _instinctFor(opponent, b), luck, 1);
        return _outcome(scoreA, scoreB, luck, challengerSealed, opponentSealed);
    }

    /// @dev Rock-paper-scissors points: entry 3a+b of RPS_TABLE holds a's (bits 0-1) and b's (bits 2-3).
    function _rps(euint64 a, euint64 b) private returns (euint64 pointsA, euint64 pointsB) {
        euint64 idx = FHE.add(FHE.add(FHE.shl(a, _const(1)), a), b);
        euint64 entry = FHE.and(FHE.shr(_const(RPS_TABLE), FHE.shl(idx, _const(2))), _const(15));
        pointsA = FHE.and(entry, _const(3));
        pointsB = FHE.shr(entry, _const(2));
    }

    /// @dev rps + instinct + luck bit `bit` of the duel's random draw.
    function _score(euint64 rps, euint64 instinct, euint64 luck, uint64 bit) private returns (euint64) {
        euint64 one = _const(1);
        euint64 roll = bit == 0 ? FHE.and(luck, one) : FHE.and(FHE.shr(luck, _const(bit)), one);
        return FHE.add(FHE.add(rps, instinct), roll);
    }

    /// @dev The higher score wins; a tie goes to the only sealed box, else to a coin (bit 2 of luck).
    function _outcome(euint64 scoreA, euint64 scoreB, euint64 luck, bool sealedA, bool sealedB)
        private
        returns (euint64)
    {
        euint64 one = _const(1);
        euint64 two = _const(2);
        euint64 tie;
        if (sealedA != sealedB) tie = sealedA ? one : two;
        else tie = FHE.add(FHE.and(FHE.shr(luck, two), one), one);
        return FHE.select(FHE.gt(scoreA, scoreB), one, FHE.select(FHE.gt(scoreB, scoreA), two, tie));
    }

    /// @dev A locked tactic as 0, 1 or 2; anything out of range counts as Pounce.
    function _tactic(euint8 locked) private returns (euint64 t) {
        t = FHE.asEuint64(locked);
        t = FHE.select(FHE.lt(t, _const(3)), t, _const(0));
    }

    /// @dev The cat's instinct (0-2) for tactic t: lane t + 1 of its instincts.
    function _instinctFor(uint256 tokenId, euint64 t) private returns (euint64) {
        euint64 shift = FHE.shl(FHE.add(t, _const(1)), _const(4));
        return FHE.and(FHE.shr(_instinctsOf(tokenId), shift), _const(3));
    }

    /// @dev Fresh encrypted randomness for one duel: bit 0 and bit 1 are each side's luck, bit 2 the coin.
    function _drawLuck() internal virtual returns (euint64) {
        return FHE.randomEuint64();
    }

    /// @dev Power = sum of the DNA's eight bytes, folded pairwise (SWAR): 11 FHE ops, once per cat.
    function _powerOf(uint256 tokenId) private returns (euint64 power) {
        power = _power[tokenId];
        if (euint64.unwrap(power) != bytes32(0)) return power;
        euint64 dna = _dnaOf(tokenId);
        euint64 m8 = _const(EVEN_BYTES);
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
