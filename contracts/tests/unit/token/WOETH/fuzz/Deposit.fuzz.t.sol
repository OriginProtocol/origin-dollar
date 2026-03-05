// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WOETH_Shared_Test} from "tests/unit/token/WOETH/shared/Shared.t.sol";

contract Unit_Fuzz_WOETH_Deposit_Test is Unit_WOETH_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- FUZZ: DEPOSIT-REDEEM ROUNDTRIP
    //////////////////////////////////////////////////////

    function testFuzz_deposit_redeemRoundtrip(uint256 amount) public {
        amount = bound(amount, 1e6, 1e24);

        _mintOETH(alice, amount);
        uint256 oethBefore = oeth.balanceOf(alice);

        // Deposit
        vm.startPrank(alice);
        oeth.approve(address(woeth), amount);
        uint256 shares = woeth.deposit(amount, alice);
        vm.stopPrank();

        // Redeem all shares
        vm.prank(alice);
        uint256 assetsBack = woeth.redeem(shares, alice, alice);

        // Should get back approximately same amount (within 1 wei rounding)
        assertApproxEqAbs(assetsBack, amount, 1);
        assertApproxEqAbs(oeth.balanceOf(alice), oethBefore, 1);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: DONATION IMMUNITY
    //////////////////////////////////////////////////////

    function testFuzz_deposit_donationImmunity(uint256 depositAmount, uint256 donationAmount) public {
        depositAmount = bound(depositAmount, 1e6, 1e24);
        donationAmount = bound(donationAmount, 1e6, 1e24);

        _mintAndDeposit(alice, depositAmount);
        uint256 totalAssetsBefore = woeth.totalAssets();

        // Donate OETH directly to WOETH
        _mintOETH(bobby, donationAmount);
        vm.prank(bobby);
        oeth.transfer(address(woeth), donationAmount);

        // totalAssets unchanged by donation
        assertEq(woeth.totalAssets(), totalAssetsBefore);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: REBASE INVARIANT
    //////////////////////////////////////////////////////

    function testFuzz_deposit_rebaseInvariant(uint256 depositAmount, uint256 yieldWETH) public {
        depositAmount = bound(depositAmount, 1e6, 1e24);
        yieldWETH = bound(yieldWETH, 1e16, 1e22);

        uint256 shares = _mintAndDeposit(alice, depositAmount);
        uint256 totalAssetsBefore = woeth.totalAssets();

        _rebase(yieldWETH);

        // After rebase, totalAssets increases
        assertGt(woeth.totalAssets(), totalAssetsBefore);

        // Shares unchanged
        assertEq(woeth.balanceOf(alice), shares);

        // Each share worth more after rebase
        assertGt(woeth.convertToAssets(1e18), woeth.convertToAssets(1e18) * totalAssetsBefore / woeth.totalAssets());
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: SHARE PRICE MONOTONIC AFTER REBASE
    //////////////////////////////////////////////////////

    function testFuzz_deposit_sharePriceIncreasesAfterRebase(uint256 depositAmount, uint256 yieldWETH) public {
        depositAmount = bound(depositAmount, 1e6, 1e24);
        yieldWETH = bound(yieldWETH, 1e16, 1e22);

        _mintAndDeposit(alice, depositAmount);
        uint256 priceBefore = woeth.convertToAssets(1e18);

        _rebase(yieldWETH);

        uint256 priceAfter = woeth.convertToAssets(1e18);
        assertGt(priceAfter, priceBefore);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: MULTIPLE DEPOSITS
    //////////////////////////////////////////////////////

    function testFuzz_deposit_multipleDepositsPreserveProportions(uint256 amount1, uint256 amount2) public {
        amount1 = bound(amount1, 1e6, 1e24);
        amount2 = bound(amount2, 1e6, 1e24);

        uint256 shares1 = _mintAndDeposit(alice, amount1);
        uint256 shares2 = _mintAndDeposit(bobby, amount2);

        // Shares proportional to deposits (within rounding)
        // shares1/shares2 ≈ amount1/amount2
        assertApproxEqAbs(shares1 * amount2, shares2 * amount1, amount1 + amount2);
    }
}
