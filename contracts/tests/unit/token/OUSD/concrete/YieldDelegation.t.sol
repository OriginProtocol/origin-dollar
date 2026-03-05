// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";
import {OUSD} from "contracts/token/OUSD.sol";

contract Unit_Concrete_OUSD_YieldDelegation_Test is Unit_OUSD_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- SETUP: Give anna some OUSD for delegation tests
    //////////////////////////////////////////////////////

    function setUp() public override {
        super.setUp();
        // Give anna 10 OUSD from matt, give josh an extra 10 from matt
        vm.startPrank(matt);
        ousd.transfer(alice, 10e18);
        ousd.transfer(josh, 10e18);
        vm.stopPrank();
        // State: matt=80, josh=110, alice=10
    }

    //////////////////////////////////////////////////////
    /// --- DELEGATE YIELD
    //////////////////////////////////////////////////////

    function test_delegateYield() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // yieldTo / yieldFrom mappings set
        assertEq(ousd.yieldTo(matt), alice);
        assertEq(ousd.yieldFrom(alice), matt);

        // Rebase states
        assertEq(uint256(ousd.rebaseState(matt)), 3); // YieldDelegationSource
        assertEq(uint256(ousd.rebaseState(alice)), 4); // YieldDelegationTarget
    }

    function test_delegateYield_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit OUSD.YieldDelegated(matt, alice);

        vm.prank(governor);
        ousd.delegateYield(matt, alice);
    }

    function test_delegateYield_sourceBecomesNonRebasing() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // Source has alternativeCPT = 1e18 (non-rebasing credits)
        assertEq(ousd.nonRebasingCreditsPerToken(matt), 1e18);
    }

    function test_delegateYield_targetReceivesYield() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // State: matt=80 (source), alice=10 (target), josh=110 (rebasing)
        // Simulate yield: 200 OUSD via changeSupply (bypasses vault rate limit)
        _changeSupply(400e18);

        // Matt (source) doesn't gain
        assertEq(ousd.balanceOf(matt), 80e18);

        // rebasingSupply = totalSupply - nonRebasingSupply = 400 - 0 = 400
        // rebasingCreditsPerToken changed so that rebasing supply distributes 200 yield
        // josh: 110/200 * 400 = 220
        assertApproxEqAbs(ousd.balanceOf(josh), 220e18, 1);
        // alice (target): gets her 10 + delegated yield from matt's 80
        // alice+matt_delegation = (10+80)/200 * 400 = 180, alice sees 180 - 80 = 100
        assertApproxEqAbs(ousd.balanceOf(alice), 100e18, 1);
    }

    function test_delegateYield_balancesPreserved() public {
        uint256 mattBefore = ousd.balanceOf(matt);
        uint256 aliceBefore = ousd.balanceOf(alice);

        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // Neither balance changes on delegation
        assertEq(ousd.balanceOf(matt), mattBefore);
        assertEq(ousd.balanceOf(alice), aliceBefore);
    }

    function test_delegateYield_toAccountWithZeroBalance() public {
        // bobby has no OUSD
        assertEq(ousd.balanceOf(bobby), 0);

        vm.prank(governor);
        ousd.delegateYield(matt, bobby);

        assertEq(ousd.balanceOf(matt), 80e18);
        assertEq(ousd.balanceOf(bobby), 0);

        // Simulate yield: 200 OUSD via changeSupply (bypasses vault rate limit)
        _changeSupply(400e18);

        // Matt doesn't gain
        assertEq(ousd.balanceOf(matt), 80e18);
        // josh: 110/200 * 400 = 220
        assertApproxEqAbs(ousd.balanceOf(josh), 220e18, 1);
        // bobby (target with 0 balance): gets matt's delegated yield
        // bobby+matt_delegation = (0+80)/200 * 400 = 160, bobby sees 160 - 80 = 80
        assertApproxEqAbs(ousd.balanceOf(bobby), 80e18, 1);
    }

    //////////////////////////////////////////////////////
    /// --- DELEGATE YIELD REVERTS
    //////////////////////////////////////////////////////

    function test_delegateYield_RevertWhen_notGovernorOrStrategist() public {
        vm.prank(matt);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousd.delegateYield(matt, alice);
    }

    function test_delegateYield_RevertWhen_zeroFrom() public {
        vm.prank(governor);
        vm.expectRevert("Zero from address not allowed");
        ousd.delegateYield(address(0), alice);
    }

    function test_delegateYield_RevertWhen_zeroTo() public {
        vm.prank(governor);
        vm.expectRevert("Zero to address not allowed");
        ousd.delegateYield(matt, address(0));
    }

    function test_delegateYield_RevertWhen_selfDelegate() public {
        vm.prank(governor);
        vm.expectRevert("Cannot delegate to self");
        ousd.delegateYield(matt, matt);
    }

    function test_delegateYield_RevertWhen_existingDelegation() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // Try another delegation involving matt (source)
        vm.prank(governor);
        vm.expectRevert("Blocked by existing yield delegation");
        ousd.delegateYield(matt, josh);

        // Try another delegation involving alice (target)
        vm.prank(governor);
        vm.expectRevert("Blocked by existing yield delegation");
        ousd.delegateYield(josh, alice);
    }

    function test_delegateYield_RevertWhen_invalidFromState() public {
        // Make matt a yield delegation source first
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // Undo, then try to delegate from alice who is YieldDelegationTarget
        vm.prank(governor);
        ousd.undelegateYield(matt);

        // alice is now StdRebasing after undelegation, so this would work
        // Instead, let's create a scenario where from is a target
        vm.prank(governor);
        ousd.delegateYield(josh, alice);

        // Try delegating from alice while she's a YieldDelegationTarget
        vm.prank(governor);
        vm.expectRevert("Blocked by existing yield delegation");
        ousd.delegateYield(alice, matt);
    }

    function test_delegateYield_RevertWhen_invalidToState() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // Try to make alice (YieldDelegationTarget) also a target of another delegation
        vm.prank(governor);
        vm.expectRevert("Blocked by existing yield delegation");
        ousd.delegateYield(josh, alice);
    }

    function test_delegateYield_whenToIsNonRebasing() public {
        // Opt out alice so she has alternativeCreditsPerToken > 0
        vm.prank(alice);
        ousd.rebaseOptOut();
        assertEq(ousd.nonRebasingCreditsPerToken(alice), 1e18);

        // Delegate yield from matt to non-rebasing alice
        // delegateYield should auto opt-in alice (line 667-668)
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // Alice should be YieldDelegationTarget now
        assertEq(uint256(ousd.rebaseState(alice)), 4); // YieldDelegationTarget
        // Balances preserved
        assertEq(ousd.balanceOf(matt), 80e18);
        assertEq(ousd.balanceOf(alice), 10e18);
    }

    function test_delegateYield_strategistCanDelegate() public {
        vm.prank(strategist);
        ousd.delegateYield(matt, alice);

        assertEq(ousd.yieldTo(matt), alice);
    }

    //////////////////////////////////////////////////////
    /// --- UNDELEGATE YIELD
    //////////////////////////////////////////////////////

    function test_undelegateYield() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        vm.prank(governor);
        ousd.undelegateYield(matt);

        // Mappings cleared
        assertEq(ousd.yieldTo(matt), address(0));
        assertEq(ousd.yieldFrom(alice), address(0));

        // States restored
        assertEq(uint256(ousd.rebaseState(matt)), 1); // StdNonRebasing
        assertEq(uint256(ousd.rebaseState(alice)), 2); // StdRebasing
    }

    function test_undelegateYield_emitsEvent() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        vm.expectEmit(false, false, false, true);
        emit OUSD.YieldUndelegated(matt, alice);

        vm.prank(governor);
        ousd.undelegateYield(matt);
    }

    function test_undelegateYield_balancesPreserved() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        uint256 mattBal = ousd.balanceOf(matt);
        uint256 aliceBal = ousd.balanceOf(alice);

        vm.prank(governor);
        ousd.undelegateYield(matt);

        assertApproxEqAbs(ousd.balanceOf(matt), mattBal, 1);
        assertApproxEqAbs(ousd.balanceOf(alice), aliceBal, 1);
    }

    function test_undelegateYield_targetKeepsAccumulatedYield() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // Simulate yield via changeSupply
        _changeSupply(400e18);

        uint256 aliceBalBeforeUndelegate = ousd.balanceOf(alice);

        vm.prank(governor);
        ousd.undelegateYield(matt);

        // Alice keeps her accumulated yield
        assertApproxEqAbs(ousd.balanceOf(alice), aliceBalBeforeUndelegate, 1);
    }

    //////////////////////////////////////////////////////
    /// --- UNDELEGATE YIELD REVERTS
    //////////////////////////////////////////////////////

    function test_undelegateYield_RevertWhen_notGovernorOrStrategist() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        vm.prank(matt);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousd.undelegateYield(matt);
    }

    function test_undelegateYield_RevertWhen_noDelegation() public {
        vm.prank(governor);
        vm.expectRevert("Zero address not allowed");
        ousd.undelegateYield(matt);
    }

    function test_undelegateYield_RevertWhen_zeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Zero address not allowed");
        ousd.undelegateYield(address(0));
    }

    //////////////////////////////////////////////////////
    /// --- FULL DELEGATION CYCLE
    //////////////////////////////////////////////////////

    function test_delegateYield_fullCycle() public {
        // Step 1: Delegate matt -> alice
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // Step 2: Simulate yield via changeSupply
        _changeSupply(400e18);

        // Matt doesn't gain (source)
        assertEq(ousd.balanceOf(matt), 80e18);
        // Alice gains her own + matt's yield
        uint256 aliceBalAfterYield = ousd.balanceOf(alice);
        assertGt(aliceBalAfterYield, 10e18);

        // Step 3: Undelegate
        vm.prank(governor);
        ousd.undelegateYield(matt);

        // Both balances preserved
        assertApproxEqAbs(ousd.balanceOf(matt), 80e18, 1);
        assertApproxEqAbs(ousd.balanceOf(alice), aliceBalAfterYield, 1);

        // Step 4: More yield — now matt is StdNonRebasing, alice is StdRebasing
        uint256 currentSupply = ousd.totalSupply();
        _changeSupply(currentSupply + 100e18);

        // Matt doesn't gain (still non-rebasing after undelegation)
        assertApproxEqAbs(ousd.balanceOf(matt), 80e18, 1);
        // Alice and josh gain yield
        assertGt(ousd.balanceOf(alice), aliceBalAfterYield);
    }

    function test_delegateYield_transferFromSource() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // Source can transfer
        vm.prank(matt);
        ousd.transfer(josh, 40e18);

        assertEq(ousd.balanceOf(matt), 40e18);
        assertApproxEqAbs(ousd.balanceOf(josh), 150e18, 1);
    }

    function test_delegateYield_transferToTarget() public {
        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        // Transfer to target
        vm.prank(josh);
        ousd.transfer(alice, 10e18);

        assertApproxEqAbs(ousd.balanceOf(alice), 20e18, 1);
        assertApproxEqAbs(ousd.balanceOf(josh), 100e18, 1);
    }
}
