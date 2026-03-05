// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WOETH_Shared_Test} from "tests/unit/token/WOETH/shared/Shared.t.sol";

contract Unit_Concrete_WOETH_Withdraw_Test is Unit_WOETH_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAW (ERC4626: withdraw exact assets)
    //////////////////////////////////////////////////////

    function test_withdraw_basic() public {
        _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        uint256 shares = woeth.withdraw(10e18, alice, alice);

        assertEq(shares, 10e18);
        assertEq(woeth.balanceOf(alice), 0);
        assertApproxEqAbs(oeth.balanceOf(alice), 10e18, 1);
    }

    function test_withdraw_toDifferentReceiver() public {
        _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        woeth.withdraw(5e18, bobby, alice);

        assertApproxEqAbs(oeth.balanceOf(bobby), 5e18, 1);
    }

    function test_withdraw_withAllowance() public {
        _mintAndDeposit(alice, 10e18);

        // Alice approves bobby to spend her WOETH shares
        vm.prank(alice);
        woeth.approve(bobby, type(uint256).max);

        // Bobby withdraws alice's assets to himself
        vm.prank(bobby);
        woeth.withdraw(5e18, bobby, alice);

        assertApproxEqAbs(oeth.balanceOf(bobby), 5e18, 1);
    }

    function test_withdraw_afterRebase() public {
        _mintAndDeposit(alice, 10e18);
        _rebase(10e18);

        // After rebase, alice's shares are worth more OETH
        uint256 maxWithdraw = woeth.maxWithdraw(alice);
        assertGt(maxWithdraw, 10e18);

        vm.prank(alice);
        woeth.withdraw(maxWithdraw, alice, alice);

        assertApproxEqAbs(oeth.balanceOf(alice), maxWithdraw, 1);
        assertEq(woeth.balanceOf(alice), 0);
    }

    function test_withdraw_RevertWhen_exceedsBalance() public {
        _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        vm.expectRevert("ERC4626: withdraw more then max");
        woeth.withdraw(11e18, alice, alice);
    }

    function test_withdraw_RevertWhen_noAllowance() public {
        _mintAndDeposit(alice, 10e18);

        vm.prank(bobby);
        vm.expectRevert("ERC20: insufficient allowance");
        woeth.withdraw(5e18, bobby, alice);
    }

    function test_withdraw_fullBalance() public {
        _mintAndDeposit(alice, 10e18);

        uint256 maxW = woeth.maxWithdraw(alice);
        vm.prank(alice);
        woeth.withdraw(maxW, alice, alice);

        assertEq(woeth.balanceOf(alice), 0);
    }

    function test_withdraw_sharePriceUnchangedAfterDonation() public {
        _mintAndDeposit(alice, 30e18);

        uint256 sharePriceBefore = woeth.convertToAssets(1e18);

        // Donate OETH directly
        _mintOETH(bobby, 100e18);
        vm.prank(bobby);
        oeth.transfer(address(woeth), 100e18);

        // Share price unchanged
        uint256 sharePriceAfter = woeth.convertToAssets(1e18);
        assertEq(sharePriceBefore, sharePriceAfter);

        // Alice withdraws max — gets fair value, not inflated by donation
        uint256 maxW = woeth.maxWithdraw(alice);
        vm.prank(alice);
        woeth.withdraw(maxW, alice, alice);

        assertApproxEqAbs(oeth.balanceOf(alice), 30e18, 1);
    }
}
