// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_MerkleizePendingDeposit_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_merkleizePendingDeposit_knownValue() public view {
        bytes32 pubKeyHash = keccak256("validator-pubkey");
        bytes memory withdrawalCreds = abi.encodePacked(bytes32(uint256(1)));
        uint64 amountGwei = 32_000_000_000;
        bytes memory sig = _makeSignature();
        uint64 slot = 1000;

        bytes32 result = beaconProofs.merkleizePendingDeposit(pubKeyHash, withdrawalCreds, amountGwei, sig, slot);
        assertTrue(result != bytes32(0));
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
