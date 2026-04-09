// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_VerifyPendingDepositsContainer_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_RevertWhen_zeroBlockRoot() public {
        bytes memory proof = _makeProof(288);
        vm.expectRevert("Invalid block root");
        beaconProofs.verifyPendingDepositsContainer(bytes32(0), keccak256("deposits"), proof);
    }

    function test_RevertWhen_wrongProofLength() public {
        bytes memory proof = _makeProof(256); // Wrong: should be 288
        vm.expectRevert("Invalid deposit container proof");
        beaconProofs.verifyPendingDepositsContainer(keccak256("root"), keccak256("deposits"), proof);
    }

    function test_RevertWhen_invalidProof() public {
        bytes memory proof = _makeProof(288);
        vm.expectRevert("Invalid deposit container proof");
        beaconProofs.verifyPendingDepositsContainer(keccak256("root"), keccak256("deposits"), proof);
    }
}
