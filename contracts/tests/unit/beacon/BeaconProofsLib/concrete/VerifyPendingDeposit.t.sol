// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_VerifyPendingDeposit_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_RevertWhen_zeroRoot() public {
        bytes memory proof = _makeProof(896);
        vm.expectRevert("Invalid root");
        beaconProofs.verifyPendingDeposit(bytes32(0), keccak256("deposit"), proof, 0);
    }

    function test_RevertWhen_wrongProofLength() public {
        bytes memory proof = _makeProof(800); // Wrong: should be 896
        vm.expectRevert("Invalid deposit proof");
        beaconProofs.verifyPendingDeposit(keccak256("root"), keccak256("deposit"), proof, 0);
    }

    function test_RevertWhen_invalidDepositIndex() public {
        // pendingDepositIndex must be < 2^(28-1) = 2^27 = 134217728
        bytes memory proof = _makeProof(896);
        vm.expectRevert("Invalid deposit index");
        beaconProofs.verifyPendingDeposit(keccak256("root"), keccak256("deposit"), proof, uint32(2 ** 27));
    }

    function test_RevertWhen_invalidDepositIndex_max() public {
        bytes memory proof = _makeProof(896);
        vm.expectRevert("Invalid deposit index");
        beaconProofs.verifyPendingDeposit(keccak256("root"), keccak256("deposit"), proof, type(uint32).max);
    }

    function test_RevertWhen_invalidProof() public {
        bytes memory proof = _makeProof(896);
        vm.expectRevert("Invalid deposit proof");
        beaconProofs.verifyPendingDeposit(keccak256("root"), keccak256("deposit"), proof, 0);
    }
}
