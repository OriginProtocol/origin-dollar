// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Merkle} from "contracts/beacon/Merkle.sol";

contract MerkleWrapper {
    function verifyInclusionSha256(
        bytes memory proof,
        bytes32 root,
        bytes32 leaf,
        uint256 index
    ) external view returns (bool) {
        return Merkle.verifyInclusionSha256(proof, root, leaf, index);
    }

    function processInclusionProofSha256(
        bytes memory proof,
        bytes32 leaf,
        uint256 index
    ) external view returns (bytes32) {
        return Merkle.processInclusionProofSha256(proof, leaf, index);
    }

    function merkleizeSha256(bytes32[] memory leaves) external pure returns (bytes32) {
        return Merkle.merkleizeSha256(leaves);
    }
}
