// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Merkle_Shared_Test} from "tests/unit/beacon/Merkle/shared/Shared.t.sol";

contract Unit_Concrete_Merkle_VerifyInclusionSha256_Test is Unit_Merkle_Shared_Test {
    function test_verifyInclusion_validProof() public view {
        bytes32[] memory leaves = new bytes32[](4);
        leaves[0] = keccak256("a");
        leaves[1] = keccak256("b");
        leaves[2] = keccak256("c");
        leaves[3] = keccak256("d");

        bytes32 root = _computeRoot(leaves);
        bytes memory proof = _buildMerkleProof(leaves, 2);

        assertTrue(merkleWrapper.verifyInclusionSha256(proof, root, leaves[2], 2));
    }

    function test_verifyInclusion_wrongRoot() public view {
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = keccak256("a");
        leaves[1] = keccak256("b");

        bytes memory proof = _buildMerkleProof(leaves, 0);
        bytes32 wrongRoot = keccak256("wrong");

        assertFalse(merkleWrapper.verifyInclusionSha256(proof, wrongRoot, leaves[0], 0));
    }

    function test_verifyInclusion_wrongLeaf() public view {
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = keccak256("a");
        leaves[1] = keccak256("b");

        bytes32 root = _computeRoot(leaves);
        bytes memory proof = _buildMerkleProof(leaves, 0);

        assertFalse(merkleWrapper.verifyInclusionSha256(proof, root, keccak256("wrong"), 0));
    }

    function test_verifyInclusion_wrongIndex() public view {
        bytes32[] memory leaves = new bytes32[](4);
        leaves[0] = keccak256("a");
        leaves[1] = keccak256("b");
        leaves[2] = keccak256("c");
        leaves[3] = keccak256("d");

        bytes32 root = _computeRoot(leaves);
        bytes memory proof = _buildMerkleProof(leaves, 0);

        // Use correct leaf but wrong index
        assertFalse(merkleWrapper.verifyInclusionSha256(proof, root, leaves[0], 1));
    }

    function test_verifyInclusion_corruptedProof() public view {
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = keccak256("a");
        leaves[1] = keccak256("b");

        bytes32 root = _computeRoot(leaves);
        bytes memory proof = _buildMerkleProof(leaves, 0);

        // Corrupt a byte in the proof
        proof[0] = ~proof[0];

        assertFalse(merkleWrapper.verifyInclusionSha256(proof, root, leaves[0], 0));
    }
}
