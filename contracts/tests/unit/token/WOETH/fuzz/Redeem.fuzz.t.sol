// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WOETH_Shared_Test} from "tests/unit/token/WOETH/shared/Shared.sol";

contract Unit_Fuzz_WOETH_Redeem_Test is Unit_WOETH_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- FUZZ: MULTI-USER PROPORTIONALITY
    //////////////////////////////////////////////////////

    function testFuzz_redeem_multiUserProportionality(uint256 amount1, uint256 amount2, uint256 yieldWETH) public {
        amount1 = bound(amount1, 1e6, 1e24);
        amount2 = bound(amount2, 1e6, 1e24);
        yieldWETH = bound(yieldWETH, 1e16, 1e22);

        uint256 shares1 = _mintAndDeposit(alice, amount1);
        uint256 shares2 = _mintAndDeposit(bobby, amount2);

        _rebase(yieldWETH);

        // Both redeem
        vm.prank(alice);
        uint256 assets1 = woeth.redeem(shares1, alice, alice);

        vm.prank(bobby);
        uint256 assets2 = woeth.redeem(shares2, bobby, bobby);

        // Assets proportional to shares (within rounding)
        // assets1/assets2 ≈ shares1/shares2
        assertApproxEqAbs(assets1 * shares2, assets2 * shares1, shares1 + shares2);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: LATE DEPOSITOR FAIRNESS
    //////////////////////////////////////////////////////

    function testFuzz_redeem_lateDepositorFairness(uint256 earlyAmount, uint256 lateAmount, uint256 yieldWETH) public {
        earlyAmount = bound(earlyAmount, 1e6, 1e24);
        lateAmount = bound(lateAmount, 1e6, 1e24);
        yieldWETH = bound(yieldWETH, 1e16, 1e22);

        // Alice deposits early
        uint256 earlyShares = _mintAndDeposit(alice, earlyAmount);

        // Rebase happens
        _rebase(yieldWETH);

        // Bobby deposits late (after rebase)
        uint256 lateShares = _mintAndDeposit(bobby, lateAmount);

        // Both redeem
        vm.prank(alice);
        uint256 earlyAssets = woeth.redeem(earlyShares, alice, alice);

        vm.prank(bobby);
        uint256 lateAssets = woeth.redeem(lateShares, bobby, bobby);

        // Early depositor gets back more than deposited (benefited from rebase)
        assertGt(earlyAssets, earlyAmount);

        // Late depositor gets back approximately what they deposited (within 2 wei rounding)
        assertApproxEqAbs(lateAssets, lateAmount, 2);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: MINT-WITHDRAW ROUNDTRIP
    //////////////////////////////////////////////////////

    function testFuzz_mintWithdrawRoundtrip(uint256 shares) public {
        shares = bound(shares, 1e6, 1e24);

        // Mint enough OETH for the shares
        uint256 assetsNeeded = woeth.previewMint(shares);
        _mintOETH(alice, assetsNeeded + 1e18); // Extra buffer for rounding

        vm.startPrank(alice);
        oeth.approve(address(woeth), type(uint256).max);
        uint256 assetsUsed = woeth.mint(shares, alice);
        vm.stopPrank();

        // Withdraw the assets back
        vm.prank(alice);
        uint256 sharesUsed = woeth.withdraw(assetsUsed, alice, alice);

        // Shares burned should approximately equal shares minted (within 1 for rounding)
        assertApproxEqAbs(sharesUsed, shares, 1);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: REDEEM NEVER EXCEEDS TOTAL ASSETS
    //////////////////////////////////////////////////////

    function testFuzz_redeem_neverExceedsTotalAssets(uint256 amount, uint256 yieldWETH) public {
        amount = bound(amount, 1e6, 1e24);
        yieldWETH = bound(yieldWETH, 1e16, 1e22);

        uint256 shares = _mintAndDeposit(alice, amount);
        _rebase(yieldWETH);

        uint256 totalAssetsBefore = woeth.totalAssets();

        vm.prank(alice);
        uint256 assets = woeth.redeem(shares, alice, alice);

        // Redeemed assets should not exceed total assets
        assertLe(assets, totalAssetsBefore + 1); // +1 for rounding
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: PARTIAL REDEEM CONSISTENCY
    //////////////////////////////////////////////////////

    function testFuzz_redeem_partialConsistency(uint256 amount, uint256 redeemFraction) public {
        amount = bound(amount, 1e8, 1e24);
        redeemFraction = bound(redeemFraction, 1, 99);

        uint256 shares = _mintAndDeposit(alice, amount);
        uint256 partialShares = (shares * redeemFraction) / 100;

        // Redeem partial
        vm.prank(alice);
        uint256 partialAssets = woeth.redeem(partialShares, alice, alice);

        // Remaining shares
        uint256 remainingShares = woeth.balanceOf(alice);
        assertEq(remainingShares, shares - partialShares);

        // Redeem rest
        vm.prank(alice);
        uint256 restAssets = woeth.redeem(remainingShares, alice, alice);

        // Total redeemed should approximate original amount
        assertApproxEqAbs(partialAssets + restAssets, amount, 2);
    }
}
