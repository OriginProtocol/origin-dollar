// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_VerifyFirstPendingDeposit_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_RevertWhen_zeroBlockRoot() public {
        bytes memory proof = _makeProof(1184);
        vm.expectRevert("Invalid block root");
        beaconProofs.verifyFirstPendingDeposit(bytes32(0), 1000, proof);
    }

    function test_RevertWhen_wrongProofLength_tooShort() public {
        bytes memory proof = _makeProof(1024); // Neither 1184 nor 1280
        vm.expectRevert("Invalid deposit slot proof");
        beaconProofs.verifyFirstPendingDeposit(keccak256("root"), 1000, proof);
    }

    function test_RevertWhen_wrongProofLength_between() public {
        bytes memory proof = _makeProof(1200); // Neither 1184 nor 1280
        vm.expectRevert("Invalid deposit slot proof");
        beaconProofs.verifyFirstPendingDeposit(keccak256("root"), 1000, proof);
    }

    function test_RevertWhen_invalidEmptyQueueProof() public {
        // 1184 bytes = 37 * 32 → empty queue path
        bytes memory proof = _makeProof(1184);
        vm.expectRevert("Invalid empty deposits proof");
        beaconProofs.verifyFirstPendingDeposit(keccak256("root"), 1000, proof);
    }

    function test_RevertWhen_invalidSlotProof() public {
        // 1280 bytes = 40 * 32 → non-empty queue path
        bytes memory proof = _makeProof(1280);
        vm.expectRevert("Invalid deposit slot proof");
        beaconProofs.verifyFirstPendingDeposit(keccak256("root"), 1000, proof);
    }
}
