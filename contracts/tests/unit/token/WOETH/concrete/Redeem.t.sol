// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_WOETH_Shared_Test} from "tests/unit/token/WOETH/shared/Shared.t.sol";

contract Unit_Concrete_WOETH_Redeem_Test is Unit_WOETH_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REDEEM (ERC4626: redeem exact shares)
    //////////////////////////////////////////////////////

    function test_redeem_basic() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        uint256 assets = woeth.redeem(shares, alice, alice);

        assertApproxEqAbs(assets, 10e18, 1);
        assertEq(woeth.balanceOf(alice), 0);
        assertApproxEqAbs(oeth.balanceOf(alice), 10e18, 1);
    }

    function test_redeem_toDifferentReceiver() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        woeth.redeem(shares / 2, bobby, alice);

        assertApproxEqAbs(oeth.balanceOf(bobby), 5e18, 1);
    }

    function test_redeem_withAllowance() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        woeth.approve(bobby, type(uint256).max);

        vm.prank(bobby);
        woeth.redeem(shares, bobby, alice);

        assertApproxEqAbs(oeth.balanceOf(bobby), 10e18, 1);
        assertEq(woeth.balanceOf(alice), 0);
    }

    function test_redeem_afterRebase() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);
        _rebase(10e18);

        // After rebase, same shares are worth more assets
        vm.prank(alice);
        uint256 assets = woeth.redeem(shares, alice, alice);

        assertGt(assets, 10e18);
    }

    function test_redeem_RevertWhen_exceedsBalance() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        vm.expectRevert("ERC4626: redeem more then max");
        woeth.redeem(shares + 1, alice, alice);
    }

    function test_redeem_RevertWhen_noAllowance() public {
        _mintAndDeposit(alice, 10e18);

        vm.prank(bobby);
        vm.expectRevert("ERC20: insufficient allowance");
        woeth.redeem(1e18, bobby, alice);
    }

    function test_redeem_partial() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        uint256 assets = woeth.redeem(shares / 2, alice, alice);

        assertApproxEqAbs(assets, 5e18, 1);
        assertEq(woeth.balanceOf(alice), shares / 2);
    }

    /// @dev Inspired by woeth.mainnet.fork-test.js "should be able to redeem all WOETH"
    function test_redeem_allUsersFullRedeem() public {
        uint256 aliceShares = _mintAndDeposit(alice, 50e18);

        _mintOETH(bobby, 100e18);
        vm.startPrank(bobby);
        oeth.approve(address(woeth), 100e18);
        uint256 bobbyShares = woeth.mint(50e18, bobby);
        vm.stopPrank();

        assertApproxEqAbs(woeth.totalAssets(), 100e18, 1);

        // Both fully redeem
        vm.prank(alice);
        woeth.redeem(aliceShares, alice, alice);

        vm.prank(bobby);
        woeth.redeem(bobbyShares, bobby, bobby);

        // WOETH fully drained
        assertEq(woeth.balanceOf(alice), 0);
        assertEq(woeth.balanceOf(bobby), 0);
        assertEq(woeth.totalSupply(), 0);
        assertEq(woeth.totalAssets(), 0);
    }

    /// @dev Inspired by woeth.mainnet.fork-test.js "should redeem at the correct ratio after rebase"
    ///      Verifies WOETH yield rate matches OETH yield rate (within 2 wei)
    function test_redeem_yieldRateMatchesOETH() public {
        uint256 initialDeposit = 50e18;
        _mintAndDeposit(alice, initialDeposit);
        uint256 aliceOethBefore = oeth.balanceOf(alice);

        // Also track a plain OETH holder for rate comparison
        // bobby holds OETH directly (from setUp he has 0, mint fresh)
        _mintOETH(bobby, initialDeposit);
        uint256 bobbyOethBefore = oeth.balanceOf(bobby);

        // Rebase
        _rebase(200e18);

        uint256 bobbyOethAfter = oeth.balanceOf(bobby);

        // Alice redeems all WOETH
        uint256 aliceShares = woeth.balanceOf(alice);
        vm.prank(alice);
        uint256 aliceRedeemed = woeth.redeem(aliceShares, alice, alice);

        // Compute yield rates (scaled by 1e18)
        uint256 oethYieldRate = ((bobbyOethAfter - bobbyOethBefore) * 1e18) / bobbyOethBefore;
        uint256 woethYieldRate = ((aliceRedeemed - initialDeposit) * 1e18) / initialDeposit;

        // WOETH yield rate should match OETH yield rate (within 2 wei of 1e18-scaled rate)
        assertApproxEqAbs(oethYieldRate, woethYieldRate, 2);
    }

    /// @dev Inspired by woeth.mainnet.fork-test.js "should not increase exchange rate when OETH is transferred"
    function test_redeem_donationDoesNotInflateRedemption() public {
        _mintAndDeposit(alice, 50e18);

        // Donate OETH to WOETH
        _mintOETH(bobby, 50e18);
        vm.prank(bobby);
        oeth.transfer(address(woeth), 50e18);

        // Redeem — alice should get back ~50 OETH, not 100
        uint256 aliceShares = woeth.balanceOf(alice);
        vm.prank(alice);
        uint256 assets = woeth.redeem(aliceShares, alice, alice);

        assertApproxEqAbs(assets, 50e18, 1);
        assertEq(woeth.totalSupply(), 0);
        assertEq(woeth.totalAssets(), 0);
        // Donated OETH remains stuck in the contract
        assertApproxEqAbs(oeth.balanceOf(address(woeth)), 50e18, 1);
    }
}
