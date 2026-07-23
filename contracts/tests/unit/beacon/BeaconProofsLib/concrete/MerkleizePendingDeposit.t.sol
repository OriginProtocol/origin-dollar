// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_MerkleizePendingDeposit_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_merkleizePendingDeposit_knownValue() public view {
        bytes memory publicKey =
            hex"a18bd0e852ab796e8020fb277090aa474fe39a2fce99004dd247324fdbf57584da5ef6a32d1121210b9e7c2b95ecf667";
        bytes32 pubKeyHash = sha256(abi.encodePacked(publicKey, bytes16(0)));
        bytes memory withdrawalCreds = hex"0100000000000000000000006f37216b54ea3fe4590ab3579fab8fd7f6dcf13f";
        uint64 amountGwei = 32_000_000_000;
        bytes memory sig =
            hex"97089277b0819bc5ecab141a2f65274994b4e7940de2e0278eb3714b4e9e85ae5814faa760e53c29b8c15bbb9b30e0c00e07f2b6d16fd1f1174a8c90d172b081d5d5b2b30b94f435045d209598232db27a31a76e652f95ddbfa453c409890668";
        uint64 slot = 12_235_962;

        bytes32 result = beaconProofs.merkleizePendingDeposit(pubKeyHash, withdrawalCreds, amountGwei, sig, slot);

        assertEq(result, 0xc27ca5bb5e66430b4eccd9aa5a90bc1783fa8aa2279461eff32751572a98d819);
    }

    function test_merkleizePendingDeposit_deterministic() public view {
        bytes32 pubKeyHash = keccak256("validator-pubkey");
        bytes memory withdrawalCreds = abi.encodePacked(bytes32(uint256(1)));
        uint64 amountGwei = 32_000_000_000;
        bytes memory sig = _makeSignature();
        uint64 slot = 1000;

        bytes32 result1 = beaconProofs.merkleizePendingDeposit(pubKeyHash, withdrawalCreds, amountGwei, sig, slot);
        bytes32 result2 = beaconProofs.merkleizePendingDeposit(pubKeyHash, withdrawalCreds, amountGwei, sig, slot);
        assertEq(result1, result2);
    }

    function test_merkleizePendingDeposit_differentInputs() public view {
        bytes memory withdrawalCreds = abi.encodePacked(bytes32(uint256(1)));
        bytes memory sig = _makeSignature();

        bytes32 result1 =
            beaconProofs.merkleizePendingDeposit(keccak256("key1"), withdrawalCreds, 32_000_000_000, sig, 1000);
        bytes32 result2 =
            beaconProofs.merkleizePendingDeposit(keccak256("key2"), withdrawalCreds, 32_000_000_000, sig, 1000);

        assertTrue(result1 != result2);
    }

    function test_merkleizePendingDeposit_differentAmounts() public view {
        bytes32 pubKeyHash = keccak256("validator-pubkey");
        bytes memory withdrawalCreds = abi.encodePacked(bytes32(uint256(1)));
        bytes memory sig = _makeSignature();

        bytes32 result1 = beaconProofs.merkleizePendingDeposit(pubKeyHash, withdrawalCreds, 32_000_000_000, sig, 1000);
        bytes32 result2 = beaconProofs.merkleizePendingDeposit(pubKeyHash, withdrawalCreds, 16_000_000_000, sig, 1000);

        assertTrue(result1 != result2);
    }
}
