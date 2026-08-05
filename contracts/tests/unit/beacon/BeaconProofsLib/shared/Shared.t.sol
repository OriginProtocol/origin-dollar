// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Project imports
import {EnhancedBeaconProofs} from "contracts/mocks/beacon/EnhancedBeaconProofs.sol";

abstract contract Unit_BeaconProofsLib_Shared_Test is Base {
    EnhancedBeaconProofs internal beaconProofs;

    function setUp() public virtual override {
        super.setUp();
        beaconProofs = new EnhancedBeaconProofs();
        vm.label(address(beaconProofs), "EnhancedBeaconProofs");
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
}
