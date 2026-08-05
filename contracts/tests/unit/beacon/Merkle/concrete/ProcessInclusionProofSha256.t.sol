// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Merkle_Shared_Test} from "tests/unit/beacon/Merkle/shared/Shared.t.sol";

// --- Project imports
import {Merkle} from "contracts/beacon/Merkle.sol";

contract Unit_Concrete_Merkle_ProcessInclusionProofSha256_Test is Unit_Merkle_Shared_Test {
    function test_processInclusion_twoLeafTree_index0() public view {
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = keccak256("left");
        leaves[1] = keccak256("right");

        bytes memory proof = _buildMerkleProof(leaves, 0);
        bytes32 root = _computeRoot(leaves);

        bytes32 computed = merkleWrapper.processInclusionProofSha256(proof, leaves[0], 0);
        assertEq(computed, root);
    }

    function test_processInclusion_twoLeafTree_index1() public view {
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = keccak256("left");
        leaves[1] = keccak256("right");

        bytes memory proof = _buildMerkleProof(leaves, 1);
        bytes32 root = _computeRoot(leaves);

        bytes32 computed = merkleWrapper.processInclusionProofSha256(proof, leaves[1], 1);
        assertEq(computed, root);
    }

    function test_processInclusion_fourLeafTree_allIndices() public view {
        bytes32[] memory leaves = new bytes32[](4);
        leaves[0] = keccak256("a");
        leaves[1] = keccak256("b");
        leaves[2] = keccak256("c");
        leaves[3] = keccak256("d");

        bytes32 root = _computeRoot(leaves);

        for (uint256 i = 0; i < 4; i++) {
            bytes memory proof = _buildMerkleProof(leaves, i);
            bytes32 computed = merkleWrapper.processInclusionProofSha256(proof, leaves[i], i);
            assertEq(computed, root);
        }
    }

    function test_RevertWhen_emptyProof() public {
        vm.expectRevert(Merkle.InvalidProofLength.selector);
        merkleWrapper.processInclusionProofSha256("", keccak256("leaf"), 0);
    }

    function test_RevertWhen_proofNotMultipleOf32() public {
        // 33 bytes — not a multiple of 32
        bytes memory badProof = new bytes(33);
        vm.expectRevert(Merkle.InvalidProofLength.selector);
        merkleWrapper.processInclusionProofSha256(badProof, keccak256("leaf"), 0);
    }

    function test_RevertWhen_proofLength31() public {
        bytes memory badProof = new bytes(31);
        vm.expectRevert(Merkle.InvalidProofLength.selector);
        merkleWrapper.processInclusionProofSha256(badProof, keccak256("leaf"), 0);
    }
}
