// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {FheCat} from "../FheCat.sol";
import {IFheCatRenderer} from "../interfaces/IFheCatRenderer.sol";

/// @notice Test-only FheCat whose next DNAs are chosen by the test, for exact arena cases.
///         Local chain only, like FheCatLocal.
contract FheCatFixedDna is FheCat {
    uint64[] private _queue;
    uint256 private _next;

    constructor(IFheCatRenderer renderer_)
        FheCat("FheCat", "FCAT", 100, msg.sender, renderer_, msg.sender, 0)
    {
        require(block.chainid == 31337, "FheCatFixedDna: local chain only");
    }

    function queueDna(uint64[] calldata dnas) external {
        for (uint256 i; i < dnas.length; ++i) _queue.push(dnas[i]);
    }

    function _drawDna() internal override returns (euint64) {
        return FHE.add(FHE.asEuint64(_queue[_next++]), FHE.asEuint64(0));
    }
}
