// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_VerifyValidatorWithdrawableEpoch_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_RevertWhen_zeroBlockRoot() public {
        bytes memory proof = _makeProof(1696);
        vm.expectRevert("Invalid block root");
        beaconProofs.verifyValidatorWithdrawable(bytes32(0), 0, 100, proof);
    }

    function test_RevertWhen_wrongProofLength() public {
        bytes memory proof = _makeProof(1600); // Wrong: should be 1696
        vm.expectRevert("Invalid withdrawable proof");
        beaconProofs.verifyValidatorWithdrawable(keccak256("root"), 0, 100, proof);
    }

    function test_RevertWhen_invalidProof() public {
        bytes memory proof = _makeProof(1696);
        vm.expectRevert("Invalid withdrawable proof");
        beaconProofs.verifyValidatorWithdrawable(keccak256("root"), 0, 100, proof);
    }
}
