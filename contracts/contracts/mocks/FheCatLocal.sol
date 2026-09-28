// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {FheCat} from "../FheCat.sol";
import {IFheCatRenderer} from "../interfaces/IFheCatRenderer.sol";

/// @notice FheCat for the local Hardhat network ONLY. Never deploy it to a real chain.
/// @dev The CoFHE mock TaskManager (@cofhe/mock-contracts 0.7.x) stubs out random-number
///      tasks, so this variant stands in a pseudo-random value that is trivially encrypted
///      and pushed through one FHE op. The resulting handle is ACL-managed exactly like a
///      real `FHE.randomEuint64()` result, so every other code path is the production one.
contract FheCatLocal is FheCat {
    uint256 private _nonce;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        address owner_,
        IFheCatRenderer renderer_,
        address royaltyReceiver,
        uint96 royaltyBps
    ) FheCat(name_, symbol_, maxSupply_, owner_, renderer_, royaltyReceiver, royaltyBps) {
        require(block.chainid == 31337, "FheCatLocal: local chain only");
    }

    function _drawDna() internal override returns (euint64) {
        uint256 r = uint256(keccak256(abi.encode(block.prevrandao, block.number, ++_nonce, address(this))));
        return FHE.add(FHE.asEuint64(uint64(r)), FHE.asEuint64(0));
    }
}
