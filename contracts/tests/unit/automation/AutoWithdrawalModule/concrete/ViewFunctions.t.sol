// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AutoWithdrawalModule_Shared_Test} from "tests/unit/automation/AutoWithdrawalModule/shared/Shared.t.sol";

contract Unit_Concrete_AutoWithdrawalModule_ViewFunctions_Test is Unit_AutoWithdrawalModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PENDING SHORTFALL
    //////////////////////////////////////////////////////

    function test_pendingShortfall_returnsQueuedMinusClaimable() public {
        mockVault.setQueueMetadata(200e18, 50e18);
        assertEq(autoWithdrawalModule.pendingShortfall(), 150e18);
    }

    function test_pendingShortfall_returnsZeroWhenFullyFunded() public {
        mockVault.setQueueMetadata(100e18, 100e18);
        assertEq(autoWithdrawalModule.pendingShortfall(), 0);
    }
}
