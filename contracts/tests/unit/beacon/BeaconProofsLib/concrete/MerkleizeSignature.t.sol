// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_MerkleizeSignature_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_merkleizeSignature_knownValue() public view {
        bytes memory sig =
            hex"ab2de5db0c4e6d61b29a48e4269251bff4565063126fcd5f77a113df22c684db709ba7c95c1eab08620090dac7267f5a07ce7e6a873ce6ec4c609c50419923b7cffdf9384d4157f19deb56f64e9072b464aa4ec0466918ca93ab4e581fab8187";
        bytes32 result = beaconProofs.merkleizeSignature(sig);

        assertEq(result, 0x5b449fedb4e3fc86a00c8b9c6de4a537c73e342bb1a83c1141d954e7912de501);
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
