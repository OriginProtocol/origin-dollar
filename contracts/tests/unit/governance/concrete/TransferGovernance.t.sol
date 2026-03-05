// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Governance_Shared_Test} from "tests/unit/governance/shared/Shared.t.sol";
import {Governable} from "contracts/governance/Governable.sol";

contract Unit_Concrete_Governance_TransferGovernance_Test is Unit_Governance_Shared_Test {
    // --- transferGovernance ---

    function test_transferGovernance() public {
        vm.prank(governor);
        governable.transferGovernance(alice);

        // Governor hasn't changed yet (2-step)
        assertEq(governable.governor(), governor);
    }

    function test_transferGovernance_emitsPendingGovernorshipTransfer() public {
        vm.expectEmit(true, true, true, true);
        emit Governable.PendingGovernorshipTransfer(governor, alice);

        vm.prank(governor);
        governable.transferGovernance(alice);
    }

    function test_transferGovernance_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        governable.transferGovernance(alice);
    }

    // --- claimGovernance ---

    function test_claimGovernance() public {
        vm.prank(governor);
        governable.transferGovernance(alice);

        vm.prank(alice);
        governable.claimGovernance();

        assertEq(governable.governor(), alice);
    }

    function test_claimGovernance_emitsGovernorshipTransferred() public {
        vm.prank(governor);
        governable.transferGovernance(alice);

        vm.expectEmit(true, true, true, true);
        emit Governable.GovernorshipTransferred(governor, alice);

        vm.prank(alice);
        governable.claimGovernance();
    }

    function test_claimGovernance_RevertWhen_notPendingGovernor() public {
        vm.prank(governor);
        governable.transferGovernance(alice);

        vm.prank(bobby);
        vm.expectRevert("Only the pending Governor can complete the claim");
        governable.claimGovernance();
    }

    // --- _changeGovernor (via exposed changeGovernor) ---

    function test_changeGovernor_RevertWhen_zeroAddress() public {
        vm.expectRevert("New Governor is address(0)");
        governable.changeGovernor(address(0));
    }

    // --- Full 2-step flow ---

    function test_governance_twoStepTransfer() public {
        // Step 1: transfer
        vm.prank(governor);
        governable.transferGovernance(alice);
        assertEq(governable.governor(), governor);

        // Step 2: claim
        vm.prank(alice);
        governable.claimGovernance();
        assertEq(governable.governor(), alice);

        // Old governor can no longer act
        vm.prank(governor);
        vm.expectRevert("Caller is not the Governor");
        governable.transferGovernance(bobby);
    }

    function test_governance_overridePending() public {
        // Transfer to alice
        vm.prank(governor);
        governable.transferGovernance(alice);

        // Override: transfer to bobby instead
        vm.prank(governor);
        governable.transferGovernance(bobby);

        // Alice can no longer claim
        vm.prank(alice);
        vm.expectRevert("Only the pending Governor can complete the claim");
        governable.claimGovernance();

        // Bobby can claim
        vm.prank(bobby);
        governable.claimGovernance();
        assertEq(governable.governor(), bobby);
    }
}
