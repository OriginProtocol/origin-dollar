// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Fuzz_BeaconProofsLib_MerkleizePendingDeposit_Test is Unit_BeaconProofsLib_Shared_Test {
    function testFuzz_merkleizePendingDeposit_deterministic(
        bytes32 pubKeyHash,
        bytes32 withdrawalCredsRaw,
        uint64 amountGwei,
        uint64 slot
    ) public view {
        bytes memory withdrawalCreds = abi.encodePacked(withdrawalCredsRaw);
        bytes memory sig = _makeSignature();

        bytes32 result1 = beaconProofs.merkleizePendingDeposit(pubKeyHash, withdrawalCreds, amountGwei, sig, slot);
        bytes32 result2 = beaconProofs.merkleizePendingDeposit(pubKeyHash, withdrawalCreds, amountGwei, sig, slot);
        assertEq(result1, result2);
    }

    function testFuzz_merkleizePendingDeposit_differentPubKey(bytes32 pubKey1, bytes32 pubKey2, uint64 amountGwei)
        public
        view
    {
        vm.assume(pubKey1 != pubKey2);
        bytes memory withdrawalCreds = abi.encodePacked(bytes32(uint256(1)));
        bytes memory sig = _makeSignature();

        bytes32 result1 = beaconProofs.merkleizePendingDeposit(pubKey1, withdrawalCreds, amountGwei, sig, 1000);
        bytes32 result2 = beaconProofs.merkleizePendingDeposit(pubKey2, withdrawalCreds, amountGwei, sig, 1000);
        assertTrue(result1 != result2);
    }
}
