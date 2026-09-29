// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Project imports
import {BeaconProofsGloas} from "contracts/beacon/BeaconProofsGloas.sol";
import {EnhancedBeaconProofs} from "contracts/mocks/beacon/EnhancedBeaconProofs.sol";

abstract contract Unit_BeaconProofsLib_Shared_Test is Base {
    EnhancedBeaconProofs internal beaconProofs;
    BeaconProofsGloas internal gloasBeaconProofs;

    function setUp() public virtual override {
        super.setUp();
        beaconProofs = new EnhancedBeaconProofs();
        gloasBeaconProofs = new BeaconProofsGloas();
        vm.label(address(beaconProofs), "EnhancedBeaconProofs");
        vm.label(address(gloasBeaconProofs), "BeaconProofsGloas");
    }

    /// @dev Create a proof of the given byte length filled with pseudo-random data
    function _makeProof(uint256 byteLength) internal pure returns (bytes memory proof) {
        proof = new bytes(byteLength);
        for (uint256 i = 0; i < byteLength; i++) {
            proof[i] = bytes1(uint8(i % 256));
        }
    }

    /// @dev Create a 96-byte BLS signature filled with pseudo-random data
    function _makeSignature() internal pure returns (bytes memory sig) {
        sig = new bytes(96);
        for (uint256 i = 0; i < 96; i++) {
            sig[i] = bytes1(uint8(i + 1));
        }
    }

    function _makeProofForIndex(uint256 generalizedIndex, bytes32 firstWitness)
        internal
        pure
        returns (bytes memory proof)
    {
        uint256 proofLength = _bitLength(generalizedIndex) - 1;
        proof = new bytes(proofLength * 32);
        assembly {
            mstore(add(proof, 32), firstWitness)
        }
        for (uint256 i = 1; i < proofLength; i++) {
            bytes32 witness = keccak256(abi.encodePacked("witness", generalizedIndex, i));
            assembly {
                mstore(add(add(proof, 32), mul(i, 32)), witness)
            }
        }
    }

    function _rootFromProof(bytes memory proof, bytes32 leaf, uint256 generalizedIndex)
        internal
        pure
        returns (bytes32)
    {
        bytes32 computedHash = leaf;
        for (uint256 i = 32; i <= proof.length; i += 32) {
            bytes32 witness;
            assembly {
                witness := mload(add(proof, i))
            }

            if (generalizedIndex % 2 == 0) {
                computedHash = sha256(abi.encodePacked(computedHash, witness));
            } else {
                computedHash = sha256(abi.encodePacked(witness, computedHash));
            }
            generalizedIndex = generalizedIndex / 2;
        }
        return computedHash;
    }

    function _bitLength(uint256 value) internal pure returns (uint256) {
        uint256 length;
        while (value > 0) {
            value >>= 1;
            length++;
        }
        return length;
    }
}
