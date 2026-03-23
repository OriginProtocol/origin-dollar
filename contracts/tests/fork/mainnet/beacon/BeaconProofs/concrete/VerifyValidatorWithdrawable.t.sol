// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_BeaconProofs_Shared_Test} from "../shared/Shared.t.sol";

contract Fork_Concrete_BeaconProofs_VerifyValidatorWithdrawable_Test is Fork_BeaconProofs_Shared_Test {
    function test_verifyValidatorWithdrawable_nonExitingValidator() public view {
        beaconProofs.verifyValidatorWithdrawable(
            beaconBlockRoot,
            nonExitingWithdrawableVector.validatorIndex,
            nonExitingWithdrawableVector.withdrawableEpoch,
            nonExitingWithdrawableVector.proof
        );

        assertEq(
            nonExitingWithdrawableVector.withdrawableEpoch,
            type(uint64).max,
            "non-exiting validator should have MAX_UINT64 withdrawable epoch"
        );
    }

    function test_verifyValidatorWithdrawable_exitedValidator() public view {
        beaconProofs.verifyValidatorWithdrawable(
            beaconBlockRoot,
            exitedWithdrawableVector.validatorIndex,
            exitedWithdrawableVector.withdrawableEpoch,
            exitedWithdrawableVector.proof
        );

        assertEq(exitedWithdrawableVector.withdrawableEpoch, 380333, "unexpected withdrawable epoch");
    }
}
