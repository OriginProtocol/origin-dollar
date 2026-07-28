// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.t.sol";

// --- Project imports
import {IProxy} from "contracts/interfaces/IProxy.sol";

contract Unit_Concrete_Proxy_Governance_Test is Unit_Proxies_Shared_Test {
    function setUp() public override {
        super.setUp();
        _initializeProxy(proxy, governor);
    }

    // --- transferGovernance ---

    function test_transferGovernance() public {
        vm.prank(governor);
        proxy.transferGovernance(alice);

        // Governor hasn't changed yet (2-step)
        assertEq(proxy.governor(), governor);
    }

    function test_transferGovernance_emitsPendingGovernorshipTransfer() public {
        vm.expectEmit(true, true, true, true);
        emit IProxy.PendingGovernorshipTransfer(governor, alice);

        vm.prank(governor);
        proxy.transferGovernance(alice);
    }

    function test_transferGovernance_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        proxy.transferGovernance(alice);
    }

    // --- claimGovernance ---

    function test_claimGovernance() public {
        vm.prank(governor);
        proxy.transferGovernance(alice);

        vm.prank(alice);
        proxy.claimGovernance();

        assertEq(proxy.governor(), alice);
    }

    function test_claimGovernance_emitsGovernorshipTransferred() public {
        vm.prank(governor);
        proxy.transferGovernance(alice);

        vm.expectEmit(true, true, true, true);
        emit IProxy.GovernorshipTransferred(governor, alice);

        vm.prank(alice);
        proxy.claimGovernance();
    }

    function test_claimGovernance_RevertWhen_notPendingGovernor() public {
        vm.prank(governor);
        proxy.transferGovernance(alice);

        vm.prank(bobby);
        vm.expectRevert("Only the pending Governor can complete the claim");
        proxy.claimGovernance();
    }

    // --- Full 2-step flow ---

    function test_governance_twoStepTransfer() public {
        // Step 1: transfer
        vm.prank(governor);
        proxy.transferGovernance(alice);
        assertEq(proxy.governor(), governor);

        // Step 2: claim
        vm.prank(alice);
        proxy.claimGovernance();
        assertEq(proxy.governor(), alice);

        // Old governor can no longer act
        vm.prank(governor);
        vm.expectRevert("Caller is not the Governor");
        proxy.transferGovernance(bobby);
    }

    function test_governance_overridePending() public {
        // Transfer to alice
        vm.prank(governor);
        proxy.transferGovernance(alice);

        // Override: transfer to bobby instead
        vm.prank(governor);
        proxy.transferGovernance(bobby);

        // Alice can no longer claim
        vm.prank(alice);
        vm.expectRevert("Only the pending Governor can complete the claim");
        proxy.claimGovernance();

        // Bobby can claim
        vm.prank(bobby);
        proxy.claimGovernance();
        assertEq(proxy.governor(), bobby);
    }
}
