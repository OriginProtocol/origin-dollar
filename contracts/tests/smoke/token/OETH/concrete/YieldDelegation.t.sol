// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETH_Shared_Test} from "tests/smoke/token/OETH/shared/Shared.t.sol";

contract Smoke_Concrete_OETH_YieldDelegation_Test is Smoke_OETH_Shared_Test {
    function test_delegateYield() public {
        _mintOETH(alice, 1e18);
        _mintOETH(bobby, 1e18);

        vm.prank(governor);
        oeth.delegateYield(alice, bobby);

        assertEq(oeth.yieldTo(alice), bobby);
        assertEq(oeth.yieldFrom(bobby), alice);
    }

    function test_delegateYield_targetReceivesSourceYield() public {
        _mintOETH(alice, 1e18);
        _mintOETH(bobby, 1e18);

        vm.prank(governor);
        oeth.delegateYield(alice, bobby);

        uint256 aliceBefore = oeth.balanceOf(alice);
        uint256 bobbyBefore = oeth.balanceOf(bobby);

        _rebase(0.1e18);

        // Alice (source) balance should not change
        assertEq(oeth.balanceOf(alice), aliceBefore);
        // Bobby (target) should receive yield for both balances
        assertGt(oeth.balanceOf(bobby), bobbyBefore);
    }

    function test_undelegateYield() public {
        _mintOETH(alice, 1e18);
        _mintOETH(bobby, 1e18);

        vm.prank(governor);
        oeth.delegateYield(alice, bobby);

        vm.prank(governor);
        oeth.undelegateYield(alice);

        assertEq(oeth.yieldTo(alice), address(0));
        assertEq(oeth.yieldFrom(bobby), address(0));
    }

    function test_delegateYield_sourceCanTransfer() public {
        _mintOETH(alice, 1e18);
        _mintOETH(bobby, 1e18);
        _mintOETH(cathy, 1e18);

        vm.prank(governor);
        oeth.delegateYield(alice, bobby);

        uint256 aliceBalance = oeth.balanceOf(alice);
        uint256 cathyBalance = oeth.balanceOf(cathy);
        uint256 bobbyBalance = oeth.balanceOf(bobby);

        vm.prank(alice);
        oeth.transfer(cathy, aliceBalance / 2);

        assertApproxEqAbs(oeth.balanceOf(alice), aliceBalance - aliceBalance / 2, 1);
        assertApproxEqAbs(oeth.balanceOf(cathy), cathyBalance + aliceBalance / 2, 1);
        assertApproxEqAbs(oeth.balanceOf(bobby), bobbyBalance, 1);
    }

    function test_undelegateYield_preservesAccumulatedYield() public {
        _mintOETH(alice, 1e18);
        _mintOETH(bobby, 1e18);

        vm.prank(governor);
        oeth.delegateYield(alice, bobby);

        uint256 bobbyBeforeRebase = oeth.balanceOf(bobby);

        _rebase(0.1e18);

        uint256 bobbyAfterRebase = oeth.balanceOf(bobby);
        assertGt(bobbyAfterRebase, bobbyBeforeRebase);

        vm.prank(governor);
        oeth.undelegateYield(alice);

        // Bobby's accumulated yield should be preserved after undelegation
        assertGe(oeth.balanceOf(bobby), bobbyBeforeRebase);
    }
}
