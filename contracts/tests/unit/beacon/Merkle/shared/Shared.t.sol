// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {MerkleWrapper} from "tests/mocks/MerkleWrapper.sol";

abstract contract Unit_Merkle_Shared_Test is Base {
    MerkleWrapper internal merkleWrapper;

    function setUp() public virtual override {
        super.setUp();
        merkleWrapper = new MerkleWrapper();
        vm.label(address(merkleWrapper), "MerkleWrapper");
    }

    /// @dev Build a valid merkle proof for a leaf at `index` in a tree of `leaves`.
    /// Leaves length must be a power of two.
    function _buildMerkleProof(bytes32[] memory leaves, uint256 index)
        internal
        pure
        returns (bytes memory proof)
    {
        uint256 n = leaves.length;
        // Copy leaves so we don't mutate the original
        bytes32[] memory layer = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            layer[i] = leaves[i];
        }

        proof = "";
        uint256 idx = index;

        while (n > 1) {
            // Sibling index
            uint256 siblingIdx = (idx % 2 == 0) ? idx + 1 : idx - 1;
            proof = abi.encodePacked(proof, layer[siblingIdx]);

            // Compute next layer
            uint256 nextN = n / 2;
            bytes32[] memory nextLayer = new bytes32[](nextN);
            for (uint256 i = 0; i < nextN; i++) {
                nextLayer[i] = sha256(abi.encodePacked(layer[2 * i], layer[2 * i + 1]));
            }
            layer = nextLayer;
            n = nextN;
            idx = idx / 2;
        }
    }

    /// @dev Compute merkle root from leaves (power-of-two count)
    function _computeRoot(bytes32[] memory leaves) internal pure returns (bytes32) {
        uint256 n = leaves.length;
        bytes32[] memory layer = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            layer[i] = leaves[i];
        }

        while (n > 1) {
            uint256 nextN = n / 2;
            bytes32[] memory nextLayer = new bytes32[](nextN);
            for (uint256 i = 0; i < nextN; i++) {
                nextLayer[i] = sha256(abi.encodePacked(layer[2 * i], layer[2 * i + 1]));
            }
            layer = nextLayer;
            n = nextN;
        }
        return layer[0];
    }
}
