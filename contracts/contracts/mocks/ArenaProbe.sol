// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @notice Test-only stand-in for an arena: one FHE op on a cat's DNA handle. CoFHE rejects the
///         op unless this contract is on the ciphertext's ACL, which is what the tests check.
contract ArenaProbe {
    function touch(bytes32 dnaHandle) external returns (bytes32) {
        return euint64.unwrap(FHE.add(euint64.wrap(dnaHandle), FHE.asEuint64(0)));
    }
}
