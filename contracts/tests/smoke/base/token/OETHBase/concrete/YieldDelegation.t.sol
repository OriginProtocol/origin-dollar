// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHBase_Shared_Test} from "tests/smoke/base/token/OETHBase/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBase_YieldDelegation_Test is Smoke_OETHBase_Shared_Test {
    function test_delegateYield() public {
        _mintOETHBase(alice, 1e18);
        _mintOETHBase(bobby, 1e18);

        vm.prank(governor);
        oethBase.delegateYield(alice, bobby);

        assertEq(oethBase.yieldTo(alice), bobby);
        assertEq(oethBase.yieldFrom(bobby), alice);
    }

    function test_delegateYield_targetReceivesSourceYield() public {
        _mintOETHBase(alice, 1e18);
        _mintOETHBase(bobby, 1e18);

        vm.prank(governor);
        oethBase.delegateYield(alice, bobby);

        uint256 aliceBefore = oethBase.balanceOf(alice);
        uint256 bobbyBefore = oethBase.balanceOf(bobby);

        _rebase(0.1e18);

        // Alice (source) balance should not change
        assertEq(oethBase.balanceOf(alice), aliceBefore);
        // Bobby (target) should receive yield for both balances
        assertGt(oethBase.balanceOf(bobby), bobbyBefore);
    }

    function test_undelegateYield() public {
        _mintOETHBase(alice, 1e18);
        _mintOETHBase(bobby, 1e18);

        vm.prank(governor);
        oethBase.delegateYield(alice, bobby);

        vm.prank(governor);
        oethBase.undelegateYield(alice);

        assertEq(oethBase.yieldTo(alice), address(0));
        assertEq(oethBase.yieldFrom(bobby), address(0));
    }

    function test_delegateYield_sourceCanTransfer() public {
        _mintOETHBase(alice, 1e18);
        _mintOETHBase(bobby, 1e18);
        _mintOETHBase(cathy, 1e18);

        vm.prank(governor);
        oethBase.delegateYield(alice, bobby);

        uint256 aliceBalance = oethBase.balanceOf(alice);
        uint256 cathyBalance = oethBase.balanceOf(cathy);
        uint256 bobbyBalance = oethBase.balanceOf(bobby);

        vm.prank(alice);
        oethBase.transfer(cathy, aliceBalance / 2);

        assertApproxEqAbs(oethBase.balanceOf(alice), aliceBalance - aliceBalance / 2, 1);
        assertApproxEqAbs(oethBase.balanceOf(cathy), cathyBalance + aliceBalance / 2, 1);
        assertApproxEqAbs(oethBase.balanceOf(bobby), bobbyBalance, 1);
    }

    function test_undelegateYield_preservesAccumulatedYield() public {
        _mintOETHBase(alice, 1e18);
        _mintOETHBase(bobby, 1e18);

        vm.prank(governor);
        oethBase.delegateYield(alice, bobby);

        uint256 bobbyBeforeRebase = oethBase.balanceOf(bobby);

        _rebase(0.1e18);

        uint256 bobbyAfterRebase = oethBase.balanceOf(bobby);
        assertGt(bobbyAfterRebase, bobbyBeforeRebase);

        vm.prank(governor);
        oethBase.undelegateYield(alice);

        // Bobby's accumulated yield should be preserved after undelegation
        assertGe(oethBase.balanceOf(bobby), bobbyBeforeRebase);
    }
}
