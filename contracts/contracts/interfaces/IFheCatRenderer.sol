// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Turns a cat's on-chain state into ERC-721 metadata. Swappable by the collection owner.
interface IFheCatRenderer {
    /// @param state     FheCat.State: 0 Unopened, 1 Peeked, 2 Opened, 3 Revealed
    /// @param dna       the plaintext DNA, only meaningful when revealed
    /// @param dnaHandle the CoFHE ciphertext handle of the encrypted DNA
    function tokenURI(uint256 tokenId, uint8 state, uint64 dna, bytes32 dnaHandle)
        external
        view
        returns (string memory);

    function contractURI() external view returns (string memory);
}
