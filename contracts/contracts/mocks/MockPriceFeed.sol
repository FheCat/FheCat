// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev A Chainlink-style ETH/USD feed for tests: 8 decimals, settable answer and age.
contract MockPriceFeed {
    int256 public answer;
    uint256 public updatedAt;

    constructor(int256 answer_) {
        set(answer_, block.timestamp);
    }

    function set(int256 answer_, uint256 updatedAt_) public {
        answer = answer_;
        updatedAt = updatedAt_;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}
