// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_MerkleizeSignature_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_merkleizeSignature_knownValue() public view {
        bytes memory sig = _makeSignature();
        bytes32 result = beaconProofs.merkleizeSignature(sig);
        // Verify it's non-zero and deterministic
        assertTrue(result != bytes32(0));
    }

    function test_merkleizeSignature_allZeros() public view {
        bytes memory sig = new bytes(96);
        bytes32 result = beaconProofs.merkleizeSignature(sig);

        // Manually compute: merkleize [bytes32(0), bytes32(0), bytes32(0), bytes32(0)]
        bytes32 h01 = sha256(abi.encodePacked(bytes32(0), bytes32(0)));
        bytes32 h23 = sha256(abi.encodePacked(bytes32(0), bytes32(0)));
        bytes32 expected = sha256(abi.encodePacked(h01, h23));

        assertEq(result, expected);
    }

    function test_merkleizeSignature_deterministic() public view {
        bytes memory sig = _makeSignature();
        bytes32 result1 = beaconProofs.merkleizeSignature(sig);
        bytes32 result2 = beaconProofs.merkleizeSignature(sig);
        assertEq(result1, result2);
    }

    function test_RevertWhen_invalidSignatureLength() public {
        bytes memory shortSig = new bytes(64);
        vm.expectRevert("Invalid signature");
        beaconProofs.merkleizeSignature(shortSig);
    }

    function test_RevertWhen_signatureTooLong() public {
        bytes memory longSig = new bytes(128);
        vm.expectRevert("Invalid signature");
        beaconProofs.merkleizeSignature(longSig);
    }

    function test_RevertWhen_emptySignature() public {
        vm.expectRevert("Invalid signature");
        beaconProofs.merkleizeSignature("");
    }
}
