// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Merkle_Shared_Test} from "tests/unit/beacon/Merkle/shared/Shared.t.sol";

contract Unit_Concrete_Merkle_MerkleizeSha256_Test is Unit_Merkle_Shared_Test {
    function test_merkleize_twoLeaves() public view {
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = keccak256("leaf0");
        leaves[1] = keccak256("leaf1");

        bytes32 expected = sha256(abi.encodePacked(leaves[0], leaves[1]));
        assertEq(merkleWrapper.merkleizeSha256(leaves), expected);
    }

    function test_merkleize_fourLeaves() public view {
        bytes32[] memory leaves = new bytes32[](4);
        leaves[0] = keccak256("a");
        leaves[1] = keccak256("b");
        leaves[2] = keccak256("c");
        leaves[3] = keccak256("d");

        bytes32 h01 = sha256(abi.encodePacked(leaves[0], leaves[1]));
        bytes32 h23 = sha256(abi.encodePacked(leaves[2], leaves[3]));
        bytes32 expected = sha256(abi.encodePacked(h01, h23));

        assertEq(merkleWrapper.merkleizeSha256(leaves), expected);
    }

    function test_merkleize_eightLeaves() public view {
        bytes32[] memory leaves = new bytes32[](8);
        for (uint256 i = 0; i < 8; i++) {
            leaves[i] = bytes32(i + 1);
        }

        bytes32 h01 = sha256(abi.encodePacked(leaves[0], leaves[1]));
        bytes32 h23 = sha256(abi.encodePacked(leaves[2], leaves[3]));
        bytes32 h45 = sha256(abi.encodePacked(leaves[4], leaves[5]));
        bytes32 h67 = sha256(abi.encodePacked(leaves[6], leaves[7]));
        bytes32 h0123 = sha256(abi.encodePacked(h01, h23));
        bytes32 h4567 = sha256(abi.encodePacked(h45, h67));
        bytes32 expected = sha256(abi.encodePacked(h0123, h4567));

        assertEq(merkleWrapper.merkleizeSha256(leaves), expected);
    }

    function test_merkleize_identicalLeaves() public view {
        bytes32[] memory leaves = new bytes32[](4);
        bytes32 leaf = keccak256("same");
        for (uint256 i = 0; i < 4; i++) {
            leaves[i] = leaf;
        }

        bytes32 h = sha256(abi.encodePacked(leaf, leaf));
        bytes32 expected = sha256(abi.encodePacked(h, h));

        assertEq(merkleWrapper.merkleizeSha256(leaves), expected);
    }

    function test_merkleize_zeroLeaves() public view {
        bytes32[] memory leaves = new bytes32[](2);
        // Both leaves are bytes32(0)

        bytes32 expected = sha256(abi.encodePacked(bytes32(0), bytes32(0)));
        assertEq(merkleWrapper.merkleizeSha256(leaves), expected);
    }

    function test_merkleize_deterministic() public view {
        bytes32[] memory leaves = new bytes32[](4);
        leaves[0] = keccak256("x");
        leaves[1] = keccak256("y");
        leaves[2] = keccak256("z");
        leaves[3] = keccak256("w");

        bytes32 result1 = merkleWrapper.merkleizeSha256(leaves);
        bytes32 result2 = merkleWrapper.merkleizeSha256(leaves);
        assertEq(result1, result2);
    }
}
