// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Turns a cat's on-chain state into ERC-721 metadata. Swappable by the collection owner.
interface IFheCatRenderer {
    /// @param revealed  whether the DNA has been decrypted on-chain
    /// @param dna       the plaintext DNA, only meaningful when `revealed`
    /// @param dnaHandle the CoFHE ciphertext handle of the encrypted DNA
    function tokenURI(uint256 tokenId, bool revealed, uint64 dna, bytes32 dnaHandle)
        external
        view
        returns (string memory);

    function contractURI() external view returns (string memory);
}
