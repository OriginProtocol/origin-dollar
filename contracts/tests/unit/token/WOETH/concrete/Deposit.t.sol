// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_WOETH_Shared_Test} from "tests/unit/token/WOETH/shared/Shared.t.sol";

contract Unit_Concrete_WOETH_Deposit_Test is Unit_WOETH_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSIT
    //////////////////////////////////////////////////////

    function test_deposit_basic() public {
        _mintOETH(alice, 10e18);
        uint256 oethBefore = oeth.balanceOf(alice);

        vm.startPrank(alice);
        oeth.approve(address(woeth), 10e18);
        uint256 shares = woeth.deposit(10e18, alice);
        vm.stopPrank();

        // Shares minted (1:1 at fresh adjuster)
        assertEq(shares, 10e18);
        assertEq(woeth.balanceOf(alice), 10e18);
        // OETH transferred from alice
        assertApproxEqAbs(oeth.balanceOf(alice), oethBefore - 10e18, 1);
    }

    function test_deposit_toDifferentReceiver() public {
        _mintOETH(alice, 10e18);

        vm.startPrank(alice);
        oeth.approve(address(woeth), 10e18);
        uint256 shares = woeth.deposit(10e18, bobby);
        vm.stopPrank();

        assertEq(shares, 10e18);
        assertEq(woeth.balanceOf(bobby), 10e18);
        assertEq(woeth.balanceOf(alice), 0);
    }

    function test_deposit_multipleUsers() public {
        _mintAndDeposit(alice, 10e18);
        _mintAndDeposit(bobby, 20e18);

        assertEq(woeth.balanceOf(alice), 10e18);
        assertEq(woeth.balanceOf(bobby), 20e18);
        assertApproxEqAbs(woeth.totalAssets(), 30e18, 1);
    }

    function test_deposit_afterRebase() public {
        _mintAndDeposit(alice, 10e18);
        _rebase(10e18);

        // After rebase, depositing 1 OETH gives fewer shares
        _mintOETH(bobby, 1e18);
        vm.startPrank(bobby);
        oeth.approve(address(woeth), 1e18);
        uint256 shares = woeth.deposit(1e18, bobby);
        vm.stopPrank();

        assertLt(shares, 1e18);
    }

    function test_deposit_RevertWhen_noApproval() public {
        _mintOETH(alice, 10e18);

        vm.prank(alice);
        vm.expectRevert("Allowance exceeded");
        woeth.deposit(10e18, alice);
    }

    function test_deposit_RevertWhen_insufficientBalance() public {
        _mintOETH(alice, 5e18);

        vm.startPrank(alice);
        oeth.approve(address(woeth), 10e18);
        vm.expectRevert("Transfer amount exceeds balance");
        woeth.deposit(10e18, alice);
        vm.stopPrank();
    }

    function test_deposit_zeroAmount() public {
        vm.prank(alice);
        uint256 shares = woeth.deposit(0, alice);
        assertEq(shares, 0);
        assertEq(woeth.balanceOf(alice), 0);
    }

    function test_deposit_sharePriceUnchangedAfterDonation() public {
        // Alice deposits first
        _mintAndDeposit(alice, 50e18);

        uint256 sharePriceBefore = woeth.convertToAssets(1e18);

        // Bobby donates OETH directly to WOETH
        _mintOETH(bobby, 100e18);
        vm.prank(bobby);
        oeth.transfer(address(woeth), 100e18);

        // Share price unchanged after donation
        uint256 sharePriceAfter = woeth.convertToAssets(1e18);
        assertEq(sharePriceBefore, sharePriceAfter);

        // Cathy deposits after donation — gets same rate
        _mintOETH(cathy, 50e18);
        vm.startPrank(cathy);
        oeth.approve(address(woeth), 50e18);
        uint256 cathyShares = woeth.deposit(50e18, cathy);
        vm.stopPrank();

        // Cathy's shares should match alice's (same deposit, same rate)
        assertEq(cathyShares, woeth.balanceOf(alice));
    }
}
