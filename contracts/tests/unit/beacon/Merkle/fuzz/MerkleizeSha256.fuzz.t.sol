// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Merkle_Shared_Test} from "tests/unit/beacon/Merkle/shared/Shared.t.sol";

contract Unit_Fuzz_Merkle_MerkleizeSha256_Test is Unit_Merkle_Shared_Test {
    function testFuzz_merkleizeSha256_twoLeaves(bytes32 a, bytes32 b) public view {
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = a;
        leaves[1] = b;

        bytes32 expected = sha256(abi.encodePacked(a, b));
        assertEq(merkleWrapper.merkleizeSha256(leaves), expected);
    }

    function testFuzz_merkleizeSha256_deterministic(bytes32 a, bytes32 b, bytes32 c, bytes32 d) public view {
        bytes32[] memory leaves = new bytes32[](4);
        leaves[0] = a;
        leaves[1] = b;
        leaves[2] = c;
        leaves[3] = d;

        bytes32 result1 = merkleWrapper.merkleizeSha256(leaves);
        bytes32 result2 = merkleWrapper.merkleizeSha256(leaves);
        assertEq(result1, result2);
    }
}
