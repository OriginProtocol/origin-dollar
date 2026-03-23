// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSD_Shared_Test} from "tests/smoke/mainnet/token/OUSD/shared/Shared.t.sol";

contract Smoke_Concrete_OUSD_YieldDelegation_Test is Smoke_OUSD_Shared_Test {
    function test_delegateYield() public {
        _mintOUSD(alice, 1000e6);
        _mintOUSD(bobby, 1000e6);

        vm.prank(governor);
        ousd.delegateYield(alice, bobby);

        assertEq(ousd.yieldTo(alice), bobby);
        assertEq(ousd.yieldFrom(bobby), alice);
    }

    function test_delegateYield_targetReceivesSourceYield() public {
        _mintOUSD(alice, 1000e6);
        _mintOUSD(bobby, 1000e6);

        vm.prank(governor);
        ousd.delegateYield(alice, bobby);

        uint256 aliceBefore = ousd.balanceOf(alice);
        uint256 bobbyBefore = ousd.balanceOf(bobby);

        _rebase(100e6);

        // Alice (source) balance should not change
        assertEq(ousd.balanceOf(alice), aliceBefore);
        // Bobby (target) should receive yield for both balances
        assertGt(ousd.balanceOf(bobby), bobbyBefore);
    }

    function test_undelegateYield() public {
        _mintOUSD(alice, 1000e6);
        _mintOUSD(bobby, 1000e6);

        vm.prank(governor);
        ousd.delegateYield(alice, bobby);

        vm.prank(governor);
        ousd.undelegateYield(alice);

        assertEq(ousd.yieldTo(alice), address(0));
        assertEq(ousd.yieldFrom(bobby), address(0));
    }

    function test_delegateYield_sourceCanTransfer() public {
        _mintOUSD(alice, 1000e6);
        _mintOUSD(bobby, 1000e6);
        _mintOUSD(cathy, 1000e6);

        vm.prank(governor);
        ousd.delegateYield(alice, bobby);

        uint256 aliceBalance = ousd.balanceOf(alice);
        uint256 cathyBalance = ousd.balanceOf(cathy);
        uint256 bobbyBalance = ousd.balanceOf(bobby);

        vm.prank(alice);
        ousd.transfer(cathy, aliceBalance / 2);

        assertApproxEqAbs(ousd.balanceOf(alice), aliceBalance - aliceBalance / 2, 1);
        assertApproxEqAbs(ousd.balanceOf(cathy), cathyBalance + aliceBalance / 2, 1);
        assertApproxEqAbs(ousd.balanceOf(bobby), bobbyBalance, 1);
    }

    function test_undelegateYield_preservesAccumulatedYield() public {
        _mintOUSD(alice, 1000e6);
        _mintOUSD(bobby, 1000e6);

        vm.prank(governor);
        ousd.delegateYield(alice, bobby);

        uint256 bobbyBeforeRebase = ousd.balanceOf(bobby);

        _rebase(100e6);

        uint256 bobbyAfterRebase = ousd.balanceOf(bobby);
        assertGt(bobbyAfterRebase, bobbyBeforeRebase);

        vm.prank(governor);
        ousd.undelegateYield(alice);

        // Bobby's accumulated yield should be preserved after undelegation
        assertGe(ousd.balanceOf(bobby), bobbyBeforeRebase);
    }
}
