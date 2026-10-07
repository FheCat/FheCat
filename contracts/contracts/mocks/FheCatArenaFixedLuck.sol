// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {FheCat} from "../FheCat.sol";
import {FheCatArena} from "../FheCatArena.sol";

/// @notice Test-only arena whose next luck draws are chosen by the test (bit 0 the challenger's
///         luck, bit 1 the opponent's, bit 2 the coin), for exact duel outcomes. Local chain only.
contract FheCatArenaFixedLuck is FheCatArena {
    uint64[] private _queue;
    uint256 private _next;

    constructor(FheCat cats_) FheCatArena(cats_) {
        require(block.chainid == 31337, "FheCatArenaFixedLuck: local chain only");
    }

    function queueLuck(uint64[] calldata draws) external {
        for (uint256 i; i < draws.length; ++i) _queue.push(draws[i]);
    }

    function _drawLuck() internal override returns (euint64) {
        if (_next >= _queue.length) return FHE.asEuint64(0);
        return FHE.add(FHE.asEuint64(_queue[_next++]), FHE.asEuint64(0));
    }
}
