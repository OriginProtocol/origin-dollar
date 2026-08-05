// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_BeaconProofs_Shared_Test} from "../shared/Shared.t.sol";

contract Fork_Concrete_BeaconProofs_VerifyPendingDeposits_Test is Fork_BeaconProofs_Shared_Test {
    function test_verifyPendingDepositsContainer() public view {
        beaconProofs.verifyPendingDepositsContainer(
            beaconBlockRoot, pendingDepositsContainerVector.leaf, pendingDepositsContainerVector.proof
        );
    }

    function test_verifyPendingDeposit() public view {
        beaconProofs.verifyPendingDeposit(
            pendingDepositVector.root,
            pendingDepositVector.leaf,
            pendingDepositVector.proof,
            pendingDepositVector.depositIndex
        );
    }

    function test_verifyFirstPendingDeposit() public view {
        bool isEmpty = beaconProofs.verifyFirstPendingDeposit(
            beaconBlockRoot, firstPendingDepositVector.slot, firstPendingDepositVector.proof
        );

        assertFalse(isEmpty, "expected a non-empty pending deposit queue");
        assertFalse(firstPendingDepositVector.isEmpty, "fixture unexpectedly reports an empty deposit queue");
    }
}
