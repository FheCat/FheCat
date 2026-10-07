// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {FheCat} from "../FheCat.sol";
import {FheCatArena} from "../FheCatArena.sol";

/// @notice FheCatArena for the local Hardhat network ONLY. Never deploy it to a real chain.
/// @dev Like FheCatLocal: the CoFHE mock TaskManager cannot draw encrypted randomness, so a
///      fight's luck is a pseudo-random value, trivially encrypted and pushed through one FHE op.
///      Everything else is the production arena.
contract FheCatArenaLocal is FheCatArena {
    uint256 private _nonce;

    constructor(FheCat cats_) FheCatArena(cats_) {
        require(block.chainid == 31337, "FheCatArenaLocal: local chain only");
    }

    function _drawLuck() internal override returns (euint64) {
        uint256 r = uint256(keccak256(abi.encode(block.prevrandao, block.number, ++_nonce, address(this))));
        return FHE.add(FHE.asEuint64(uint64(r)), FHE.asEuint64(0));
    }
}
