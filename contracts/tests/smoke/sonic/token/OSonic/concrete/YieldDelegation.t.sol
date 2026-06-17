// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OSonic_Shared_Test} from "tests/smoke/sonic/token/OSonic/shared/Shared.t.sol";

contract Smoke_Concrete_OSonic_YieldDelegation_Test is Smoke_OSonic_Shared_Test {
    function test_delegateYield() public {
        _mintOSonic(alice, 1e18);
        _mintOSonic(bobby, 1e18);

        vm.prank(governor);
        oSonic.delegateYield(alice, bobby);

        assertEq(oSonic.yieldTo(alice), bobby);
        assertEq(oSonic.yieldFrom(bobby), alice);
    }

    function test_delegateYield_targetReceivesSourceYield() public {
        _mintOSonic(alice, 1e18);
        _mintOSonic(bobby, 1e18);

        vm.prank(governor);
        oSonic.delegateYield(alice, bobby);

        uint256 aliceBefore = oSonic.balanceOf(alice);
        uint256 bobbyBefore = oSonic.balanceOf(bobby);

        _rebase(0.1e18);

        // Alice (source) balance should not change
        assertEq(oSonic.balanceOf(alice), aliceBefore);
        // Bobby (target) should receive yield for both balances
        assertGt(oSonic.balanceOf(bobby), bobbyBefore);
    }

    function test_undelegateYield() public {
        _mintOSonic(alice, 1e18);
        _mintOSonic(bobby, 1e18);

        vm.prank(governor);
        oSonic.delegateYield(alice, bobby);

        vm.prank(governor);
        oSonic.undelegateYield(alice);

        assertEq(oSonic.yieldTo(alice), address(0));
        assertEq(oSonic.yieldFrom(bobby), address(0));
    }

    function test_delegateYield_sourceCanTransfer() public {
        _mintOSonic(alice, 1e18);
        _mintOSonic(bobby, 1e18);
        _mintOSonic(cathy, 1e18);

        vm.prank(governor);
        oSonic.delegateYield(alice, bobby);

        uint256 aliceBalance = oSonic.balanceOf(alice);
        uint256 cathyBalance = oSonic.balanceOf(cathy);
        uint256 bobbyBalance = oSonic.balanceOf(bobby);

        vm.prank(alice);
        oSonic.transfer(cathy, aliceBalance / 2);

        assertApproxEqAbs(oSonic.balanceOf(alice), aliceBalance - aliceBalance / 2, 1);
        assertApproxEqAbs(oSonic.balanceOf(cathy), cathyBalance + aliceBalance / 2, 1);
        assertApproxEqAbs(oSonic.balanceOf(bobby), bobbyBalance, 1);
    }

    function test_undelegateYield_preservesAccumulatedYield() public {
        _mintOSonic(alice, 1e18);
        _mintOSonic(bobby, 1e18);

        vm.prank(governor);
        oSonic.delegateYield(alice, bobby);

        uint256 bobbyBeforeRebase = oSonic.balanceOf(bobby);

        _rebase(0.1e18);

        uint256 bobbyAfterRebase = oSonic.balanceOf(bobby);
        assertGt(bobbyAfterRebase, bobbyBeforeRebase);

        vm.prank(governor);
        oSonic.undelegateYield(alice);

        // Bobby's accumulated yield should be preserved after undelegation
        assertGe(oSonic.balanceOf(bobby), bobbyBeforeRebase);
    }
}
