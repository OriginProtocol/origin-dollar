// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Shared_Test} from "tests/unit/vault/OUSDVault/shared/Shared.t.sol";

// --- Project imports
import {Governable} from "contracts/governance/Governable.sol";

contract Unit_Concrete_OUSDVault_Governance_Test is Unit_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- GOVERNOR()
    //////////////////////////////////////////////////////

    function test_governor_returnsCorrectAddress() public view {
        assertEq(ousdVault.governor(), governor, "Governor address mismatch");
    }

    //////////////////////////////////////////////////////
    /// --- ISGOVERNOR()
    //////////////////////////////////////////////////////

    function test_isGovernor_trueForGovernor() public {
        vm.prank(governor);
        assertTrue(ousdVault.isGovernor(), "Governor should return true");
    }

    function test_isGovernor_falseForNonGovernor() public {
        vm.prank(alice);
        assertFalse(ousdVault.isGovernor(), "Non-governor should return false");
    }

    //////////////////////////////////////////////////////
    /// --- TRANSFERGOVERNANCE() + CLAIMGOVERNANCE()
    //////////////////////////////////////////////////////

    function test_transferGovernance_emitsPendingEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit Governable.PendingGovernorshipTransfer(governor, alice);
        ousdVault.transferGovernance(alice);
    }

    function test_claimGovernance_twoStepFlow() public {
        // Step 1: Transfer
        vm.prank(governor);
        ousdVault.transferGovernance(alice);

        // Governor is still the old governor
        assertEq(ousdVault.governor(), governor);

        // Step 2: Claim
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit Governable.GovernorshipTransferred(governor, alice);
        ousdVault.claimGovernance();

        // New governor
        assertEq(ousdVault.governor(), alice, "Governor not updated after claim");
    }

    function test_transferGovernance_RevertWhen_callerIsNotGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.transferGovernance(alice);
    }

    function test_claimGovernance_RevertWhen_callerIsNotPendingGovernor() public {
        vm.prank(governor);
        ousdVault.transferGovernance(alice);

        vm.prank(bobby);
        vm.expectRevert("Only the pending Governor can complete the claim");
        ousdVault.claimGovernance();
    }

    function test_claimGovernance_RevertWhen_noPendingTransfer() public {
        vm.prank(alice);
        vm.expectRevert("Only the pending Governor can complete the claim");
        ousdVault.claimGovernance();
    }

    function test_transferGovernance_canBeOverridden() public {
        // Transfer to alice
        vm.prank(governor);
        ousdVault.transferGovernance(alice);

        // Override: transfer to bobby instead
        vm.prank(governor);
        ousdVault.transferGovernance(bobby);

        // Alice can no longer claim
        vm.prank(alice);
        vm.expectRevert("Only the pending Governor can complete the claim");
        ousdVault.claimGovernance();

        // Bobby can claim
        vm.prank(bobby);
        ousdVault.claimGovernance();
        assertEq(ousdVault.governor(), bobby);
    }
}
