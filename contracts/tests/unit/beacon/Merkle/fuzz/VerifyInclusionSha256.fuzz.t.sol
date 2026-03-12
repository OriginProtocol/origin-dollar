// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkle_Shared_Test} from "tests/unit/beacon/Merkle/shared/Shared.t.sol";

contract Unit_Fuzz_Merkle_VerifyInclusionSha256_Test is Unit_Merkle_Shared_Test {
    function testFuzz_verifyInclusionSha256_fourLeaves(bytes32[4] memory rawLeaves, uint8 rawIndex) public view {
        uint256 index = uint256(rawIndex) % 4;

        bytes32[] memory leaves = new bytes32[](4);
        for (uint256 i = 0; i < 4; i++) {
            leaves[i] = rawLeaves[i];
        }

        bytes32 root = _computeRoot(leaves);
        bytes memory proof = _buildMerkleProof(leaves, index);

        assertTrue(merkleWrapper.verifyInclusionSha256(proof, root, leaves[index], index));
    }

    function testFuzz_verifyInclusionSha256_invalidRoot(bytes32 leaf, bytes32 sibling, bytes32 fakeRoot) public view {
        // Build a simple 2-leaf tree
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = leaf;
        leaves[1] = sibling;

        bytes32 realRoot = _computeRoot(leaves);
        // Skip if fakeRoot happens to match
        vm.assume(fakeRoot != realRoot);

        bytes memory proof = _buildMerkleProof(leaves, 0);
        assertFalse(merkleWrapper.verifyInclusionSha256(proof, fakeRoot, leaf, 0));
    }
}
