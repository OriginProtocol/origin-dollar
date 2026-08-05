// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_BeaconProofs_Shared_Test} from "../shared/Shared.t.sol";

contract Fork_Concrete_BeaconProofs_VerifyBalances_Test is Fork_BeaconProofs_Shared_Test {
    function test_verifyBalancesContainer() public view {
        beaconProofs.verifyBalancesContainer(
            beaconBlockRoot, balancesContainerVector.leaf, balancesContainerVector.proof
        );
    }

    function test_verifyValidatorBalance() public view {
        uint256 balance = beaconProofs.verifyValidatorBalance(
            validatorBalanceVector.root,
            validatorBalanceVector.leaf,
            validatorBalanceVector.proof,
            validatorBalanceVector.validatorIndex
        );

        assertEq(balance, validatorBalanceVector.balance, "validator balance mismatch");
    }
}
