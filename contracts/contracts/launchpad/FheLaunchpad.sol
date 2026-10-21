// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FheLaunchToken} from "./FheLaunchToken.sol";

interface IPriceFeed {
    function latestRoundData() external view returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80);
}

/// @title FheLaunchpad: fair launches of dual-mode (public + shielded) tokens
/// @notice Anyone launches a token for a $1 launch fee (paid in ETH at the Chainlink ETH/USD price).
///         Buyers send ETH during the sale; when it ends every buyer gets a share of the sale supply
///         in proportion to what they sent, into their public balance or straight into their
///         shielded (FHE-encrypted) balance. If the soft cap isn't reached, everyone takes their
///         ETH back.
///
/// A successful sale pays a platform fee (2% of the ETH raised): half goes to the FheCat holders
/// (FheCatRewards), half to the platform treasury. The rest of the ETH and the creator's share of
/// the supply go to the creator. The launch fee goes to the treasury.
contract FheLaunchpad is Ownable2Step, ReentrancyGuard {
    enum Status {
        Live,
        Succeeded,
        Failed
    }

    struct Launch {
        address creator;
        FheLaunchToken token;
        uint256 saleSupply;
        uint256 creatorSupply;
        uint256 softCap;
        uint256 hardCap;
        uint256 maxPerWallet;
        uint64 start;
        uint64 end;
        uint256 raised;
        Status status;
        string info;
    }

    uint256 public constant MAX_FEE_BPS = 1_000;
    uint256 public constant MIN_DURATION = 5 minutes;
    uint256 public constant MAX_DURATION = 30 days;
    /// @notice Largest supply in whole tokens, so balances fit 64-bit encrypted integers (6 decimals).
    uint256 public constant MAX_SUPPLY_TOKENS = 1_000_000_000_000;

    /// @notice Platform fee on the ETH a successful sale raises, in basis points (200 = 2%).
    uint256 public feeBps = 200;
    /// @notice Part of the platform fee that goes to FheCat holders, in basis points (5000 = half).
    uint256 public holderShareBps = 5_000;
    /// @notice Launch fee in USD with 8 decimals, like the Chainlink feed (1e8 = $1).
    uint256 public launchFeeUsd = 1e8;
    /// @notice Oldest Chainlink answer the launch fee accepts.
    uint256 public maxPriceAge = 1 days;

    IPriceFeed public priceFeed;
    address public treasury;
    address payable public holderRewards;

    Launch[] private _launches;
    mapping(uint256 => mapping(address => uint256)) public contributed;
    mapping(uint256 => mapping(address => bool)) public claimed;
    /// @notice ETH a payout couldn't push (a contract that refuses ETH); withdraw with `withdrawOwed`.
    mapping(address => uint256) public owed;

    event Launched(uint256 indexed id, address indexed creator, address token, string name, string symbol, uint256 launchFee);
    event Contributed(uint256 indexed id, address indexed buyer, uint256 amount, uint256 raised);
    event Finalized(uint256 indexed id, bool succeeded, uint256 raised, uint256 fee, uint256 toHolders);
    event TokensClaimed(uint256 indexed id, address indexed buyer, uint256 amount, bool shielded);
    event Refunded(uint256 indexed id, address indexed buyer, uint256 amount);
    event FeesChanged(uint256 feeBps, uint256 holderShareBps, uint256 launchFeeUsd);

    error BadParams(string why);
    error LaunchFeeTooLow(uint256 required);
    error StalePrice();
    error NotLive(uint256 id);
    error SaleNotStarted(uint256 id);
    error SaleOver(uint256 id);
    error SaleFull(uint256 id);
    error SaleNotOver(uint256 id);
    error WalletLimit(uint256 id, uint256 left);
    error NotSucceeded(uint256 id);
    error NotFailed(uint256 id);
    error NothingToClaim(uint256 id);
    error UnknownLaunch(uint256 id);
    error TransferFailed();

    constructor(address owner_, address treasury_, address payable holderRewards_, address priceFeed_) Ownable(owner_) {
        treasury = treasury_;
        holderRewards = holderRewards_;
        priceFeed = IPriceFeed(priceFeed_);
    }

    // ---------------------------------------------------------------------
    // launch
    // ---------------------------------------------------------------------

    /// @notice The launch fee in wei right now ($1 at the Chainlink ETH/USD price).
    function launchFeeWei() public view returns (uint256) {
        (, int256 answer, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        if (answer <= 0 || block.timestamp - updatedAt > maxPriceAge) revert StalePrice();
        // usd (8 decimals) * 1e18 / (usd per ETH, 8 decimals), rounded up
        return (launchFeeUsd * 1e18 + uint256(answer) - 1) / uint256(answer);
    }

    /// @notice What a creator sets for a launch.
    /// @param supplyTokens  whole tokens minted (6 decimals are added)
    /// @param saleBps       share of the supply sold, in basis points; the rest goes to the creator
    /// @param softCap       ETH the sale must reach to succeed (0 = any amount)
    /// @param hardCap       most ETH the sale takes
    /// @param maxPerWallet  most ETH one wallet may send (0 = no limit)
    /// @param duration      seconds the sale stays open from now
    /// @param info          a short line or link shown with the launch
    struct LaunchParams {
        string name;
        string symbol;
        uint256 supplyTokens;
        uint256 saleBps;
        uint256 softCap;
        uint256 hardCap;
        uint256 maxPerWallet;
        uint256 duration;
        string info;
    }

    /// @notice Launch a token. Send at least `launchFeeWei()`; the rest comes back.
    function createLaunch(LaunchParams calldata p) external payable nonReentrant returns (uint256 id) {
        if (bytes(p.name).length == 0 || bytes(p.name).length > 32) revert BadParams("name");
        if (bytes(p.symbol).length == 0 || bytes(p.symbol).length > 11) revert BadParams("symbol");
        if (bytes(p.info).length > 200) revert BadParams("info");
        if (p.supplyTokens == 0 || p.supplyTokens > MAX_SUPPLY_TOKENS) revert BadParams("supply");
        if (p.saleBps == 0 || p.saleBps > 10_000) revert BadParams("sale share");
        if (p.hardCap == 0 || p.softCap > p.hardCap) revert BadParams("caps");
        if (p.duration < MIN_DURATION || p.duration > MAX_DURATION) revert BadParams("duration");

        uint256 fee = launchFeeWei();
        if (msg.value < fee) revert LaunchFeeTooLow(fee);

        uint256 supply = p.supplyTokens * 1e6;
        uint256 saleSupply = (supply * p.saleBps) / 10_000;
        FheLaunchToken token = new FheLaunchToken(p.name, p.symbol, supply, address(this));

        id = _launches.length;
        Launch storage l = _launches.push();
        l.creator = msg.sender;
        l.token = token;
        l.saleSupply = saleSupply;
        l.creatorSupply = supply - saleSupply;
        l.softCap = p.softCap;
        l.hardCap = p.hardCap;
        l.maxPerWallet = p.maxPerWallet;
        l.start = uint64(block.timestamp);
        l.end = uint64(block.timestamp + p.duration);
        l.info = p.info;
        emit Launched(id, msg.sender, address(token), p.name, p.symbol, fee);

        _pay(treasury, fee);
        if (msg.value > fee) _pay(msg.sender, msg.value - fee);
    }

    // ---------------------------------------------------------------------
    // sale
    // ---------------------------------------------------------------------

    /// @notice Buy into a sale. Anything over the hard cap or your wallet limit is sent back.
    function contribute(uint256 id) external payable nonReentrant {
        Launch storage l = _launch(id);
        if (l.status != Status.Live) revert NotLive(id);
        if (block.timestamp < l.start) revert SaleNotStarted(id);
        if (block.timestamp >= l.end) revert SaleOver(id);
        uint256 room = l.hardCap - l.raised;
        if (room == 0) revert SaleFull(id);
        uint256 amount = msg.value < room ? msg.value : room;
        if (l.maxPerWallet != 0) {
            uint256 left = l.maxPerWallet - contributed[id][msg.sender];
            if (left == 0) revert WalletLimit(id, 0);
            if (amount > left) amount = left;
        }
        if (amount == 0) revert BadParams("amount");
        contributed[id][msg.sender] += amount;
        l.raised += amount;
        emit Contributed(id, msg.sender, amount, l.raised);
        if (msg.value > amount) _pay(msg.sender, msg.value - amount);
    }

    /// @notice Close a sale once its time is up or it is full. Anyone can.
    function finalize(uint256 id) external nonReentrant {
        Launch storage l = _launch(id);
        if (l.status != Status.Live) revert NotLive(id);
        if (block.timestamp < l.end && l.raised < l.hardCap) revert SaleNotOver(id);

        if (l.raised == 0 || l.raised < l.softCap) {
            l.status = Status.Failed;
            emit Finalized(id, false, l.raised, 0, 0);
            return;
        }
        l.status = Status.Succeeded;
        uint256 fee = (l.raised * feeBps) / 10_000;
        uint256 toHolders = (fee * holderShareBps) / 10_000;
        emit Finalized(id, true, l.raised, fee, toHolders);

        if (toHolders != 0) _pay(holderRewards, toHolders);
        if (fee > toHolders) _pay(treasury, fee - toHolders);
        _pay(l.creator, l.raised - fee);
        if (l.creatorSupply != 0) l.token.transfer(l.creator, l.creatorSupply);
    }

    /// @notice Your share of a successful sale's supply: public, or straight into your shielded balance.
    function claim(uint256 id, bool shielded) external nonReentrant returns (uint256 amount) {
        Launch storage l = _launch(id);
        if (l.status != Status.Succeeded) revert NotSucceeded(id);
        amount = claimable(id, msg.sender);
        if (amount == 0 || claimed[id][msg.sender]) revert NothingToClaim(id);
        claimed[id][msg.sender] = true;
        if (shielded) l.token.shieldFor(msg.sender, amount);
        else l.token.transfer(msg.sender, amount);
        emit TokensClaimed(id, msg.sender, amount, shielded);
    }

    /// @notice Your ETH back from a sale that missed its soft cap.
    function refund(uint256 id) external nonReentrant {
        Launch storage l = _launch(id);
        if (l.status != Status.Failed) revert NotFailed(id);
        uint256 amount = contributed[id][msg.sender];
        if (amount == 0) revert NothingToClaim(id);
        contributed[id][msg.sender] = 0;
        emit Refunded(id, msg.sender, amount);
        _pay(msg.sender, amount);
    }

    /// @notice ETH a payout couldn't push to you.
    function withdrawOwed() external nonReentrant {
        uint256 amount = owed[msg.sender];
        if (amount == 0) revert TransferFailed();
        owed[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ---------------------------------------------------------------------
    // views
    // ---------------------------------------------------------------------

    function launchCount() external view returns (uint256) {
        return _launches.length;
    }

    function getLaunch(uint256 id) external view returns (Launch memory) {
        return _launch(id);
    }

    /// @notice Tokens `buyer` gets from a sale as it stands (final once it has succeeded).
    function claimable(uint256 id, address buyer) public view returns (uint256) {
        Launch storage l = _launch(id);
        if (l.raised == 0 || claimed[id][buyer]) return 0;
        return (l.saleSupply * contributed[id][buyer]) / l.raised;
    }

    // ---------------------------------------------------------------------
    // owner
    // ---------------------------------------------------------------------

    function setFees(uint256 feeBps_, uint256 holderShareBps_, uint256 launchFeeUsd_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS || holderShareBps_ > 10_000) revert BadParams("fees");
        feeBps = feeBps_;
        holderShareBps = holderShareBps_;
        launchFeeUsd = launchFeeUsd_;
        emit FeesChanged(feeBps_, holderShareBps_, launchFeeUsd_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
    }

    function setHolderRewards(address payable holderRewards_) external onlyOwner {
        holderRewards = holderRewards_;
    }

    function setPriceFeed(address priceFeed_, uint256 maxPriceAge_) external onlyOwner {
        priceFeed = IPriceFeed(priceFeed_);
        maxPriceAge = maxPriceAge_;
    }

    // ---------------------------------------------------------------------
    // internal
    // ---------------------------------------------------------------------

    function _launch(uint256 id) private view returns (Launch storage) {
        if (id >= _launches.length) revert UnknownLaunch(id);
        return _launches[id];
    }

    /// @dev Pushes ETH; if the receiver refuses it, keeps it for them to withdraw.
    function _pay(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) owed[to] += amount;
    }
}
