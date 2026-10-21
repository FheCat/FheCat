// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IFheCatSupply {
    function totalSupply() external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title FheCatRewards: the FheCat holders' share of launchpad fees
/// @notice Every deposit is split equally between the cats minted at that moment. A cat's share
///         follows the cat: whoever holds it claims it, whenever they like.
///
/// FheCat ids run 1, 2, 3, ... with no gaps and no burns, so "the cats minted at that moment" is
/// ids 1..totalSupply. Each deposit records that supply and a running total of ETH per cat; a cat
/// is owed what was added from the first deposit its id was part of. Cats minted later don't share
/// in earlier deposits. Rounding leftovers roll into the next deposit.
contract FheCatRewards is ReentrancyGuard {
    IFheCatSupply public immutable cats;

    /// @dev Supply at each deposit (never decreases) and cumulative wei per cat *before* that deposit.
    uint256[] private _supplyAt;
    uint256[] private _accBefore;
    /// @notice Cumulative wei per cat over all deposits.
    uint256 public accPerCat;
    /// @notice Wei not yet split: rounding leftovers, and anything sent before the first cat.
    uint256 public carry;

    /// @notice Wei a cat has already been paid.
    mapping(uint256 => uint256) public claimed;

    event Deposited(uint256 amount, uint256 supply, uint256 perCat);
    event Claimed(uint256 indexed tokenId, address indexed holder, uint256 amount);

    error NotHolder(uint256 tokenId);
    error NothingToClaim();
    error TransferFailed();

    constructor(address cats_) {
        cats = IFheCatSupply(cats_);
    }

    receive() external payable {
        _deposit(msg.value);
    }

    /// @notice Add ETH for the holders of every cat minted so far.
    function deposit() external payable {
        _deposit(msg.value);
    }

    function _deposit(uint256 amount) private {
        uint256 supply = cats.totalSupply();
        uint256 pool = amount + carry;
        if (supply == 0) {
            carry = pool;
            return;
        }
        uint256 perCat = pool / supply;
        carry = pool - perCat * supply;
        if (perCat == 0) return;
        _supplyAt.push(supply);
        _accBefore.push(accPerCat);
        accPerCat += perCat;
        emit Deposited(amount, supply, perCat);
    }

    /// @notice Wei a cat can claim now.
    function pending(uint256 tokenId) public view returns (uint256) {
        uint256 i = _firstDepositFor(tokenId);
        if (i == _supplyAt.length) return 0;
        return accPerCat - _accBefore[i] - claimed[tokenId];
    }

    /// @notice Wei the given cats can claim now, together.
    function pendingMany(uint256[] calldata tokenIds) external view returns (uint256 total) {
        for (uint256 k; k < tokenIds.length; ++k) total += pending(tokenIds[k]);
    }

    /// @notice Claim the rewards of cats you hold, paid to you.
    function claim(uint256[] calldata tokenIds) external nonReentrant returns (uint256 total) {
        for (uint256 k; k < tokenIds.length; ++k) {
            uint256 id = tokenIds[k];
            if (cats.ownerOf(id) != msg.sender) revert NotHolder(id);
            uint256 owed = pending(id);
            if (owed == 0) continue;
            claimed[id] += owed;
            total += owed;
            emit Claimed(id, msg.sender, owed);
        }
        if (total == 0) revert NothingToClaim();
        (bool ok, ) = msg.sender.call{value: total}("");
        if (!ok) revert TransferFailed();
    }

    function depositCount() external view returns (uint256) {
        return _supplyAt.length;
    }

    /// @dev The first deposit whose supply covers `tokenId` (supplies only grow): a binary search.
    function _firstDepositFor(uint256 tokenId) private view returns (uint256 lo) {
        uint256 hi = _supplyAt.length;
        while (lo < hi) {
            uint256 mid = (lo + hi) / 2;
            if (_supplyAt[mid] >= tokenId) hi = mid;
            else lo = mid + 1;
        }
    }
}
