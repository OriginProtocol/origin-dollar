// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSDCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Smoke_Concrete_OUSDCurveAMOStrategy_Rebalance_Test is Smoke_OUSDCurveAMOStrategy_Shared_Test {
    // ─── mintAndAddOTokens (pool tilted to hardAsset) ────────────────

    function test_mintAndAddOTokens_improvesPoolBalance() public {
        _seedVaultForSolvency(10_000_000e6);
        _ensurePoolExcessHardAsset(1_000_000 ether);

        uint256[] memory balancesBefore = curveAMOStrategy.curvePool().get_balances();
        int256 diffBefore = int256(balancesBefore[curveAMOStrategy.hardAssetCoinIndex()] * 1e12)
            - int256(balancesBefore[curveAMOStrategy.otokenCoinIndex()]);

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(500_000 ether);

        uint256[] memory balancesAfter = curveAMOStrategy.curvePool().get_balances();
        int256 diffAfter = int256(balancesAfter[curveAMOStrategy.hardAssetCoinIndex()] * 1e12)
            - int256(balancesAfter[curveAMOStrategy.otokenCoinIndex()]);

        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after mintAndAddOTokens");
    }

    function test_mintAndAddOTokens_gaugeBalanceIncreases() public {
        _seedVaultForSolvency(10_000_000e6);
        _ensurePoolExcessHardAsset(1_000_000 ether);

        uint256 gaugeBefore = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(500_000 ether);

        uint256 gaugeAfter = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        assertGt(gaugeAfter, gaugeBefore, "Gauge balance should increase after mintAndAddOTokens");
    }

    function test_mintAndAddOTokens_checkBalanceIncreases() public {
        _seedVaultForSolvency(10_000_000e6);
        _ensurePoolExcessHardAsset(1_000_000 ether);

        uint256 balanceBefore = curveAMOStrategy.checkBalance(address(usdc));

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(500_000 ether);

        uint256 balanceAfter = curveAMOStrategy.checkBalance(address(usdc));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after mintAndAddOTokens");
    }

    function test_mintAndAddOTokens_noResidualTokens() public {
        _seedVaultForSolvency(10_000_000e6);
        _ensurePoolExcessHardAsset(1_000_000 ether);

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(500_000 ether);

        assertEq(
            IERC20(address(ousd)).balanceOf(address(curveAMOStrategy)),
            0,
            "No residual OUSD on strategy"
        );
        assertEq(usdc.balanceOf(address(curveAMOStrategy)), 0, "No residual USDC on strategy");
    }

    // ─── removeAndBurnOTokens (pool tilted to oToken) ────────────────

    function test_removeAndBurnOTokens_improvesPoolBalance() public {
        _depositToStrategy(500_000e6);
        _ensurePoolExcessOToken(1_000_000 ether);

        uint256[] memory balancesBefore = curveAMOStrategy.curvePool().get_balances();
        int256 diffBefore = int256(balancesBefore[curveAMOStrategy.otokenCoinIndex()])
            - int256(balancesBefore[curveAMOStrategy.hardAssetCoinIndex()] * 1e12);

        uint256 gaugeBalance = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 10;

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256[] memory balancesAfter = curveAMOStrategy.curvePool().get_balances();
        int256 diffAfter = int256(balancesAfter[curveAMOStrategy.otokenCoinIndex()])
            - int256(balancesAfter[curveAMOStrategy.hardAssetCoinIndex()] * 1e12);

        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after removeAndBurnOTokens");
    }

    function test_removeAndBurnOTokens_oTokenSupplyDecreases() public {
        _depositToStrategy(500_000e6);
        _ensurePoolExcessOToken(1_000_000 ether);

        uint256 supplyBefore = IERC20(address(ousd)).totalSupply();

        uint256 gaugeBalance = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 10;

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256 supplyAfter = IERC20(address(ousd)).totalSupply();
        assertLt(supplyAfter, supplyBefore, "OUSD totalSupply should decrease");
    }

    function test_removeAndBurnOTokens_gaugeBalanceDecreases() public {
        _depositToStrategy(500_000e6);
        _ensurePoolExcessOToken(1_000_000 ether);

        uint256 gaugeBefore = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBefore / 10;

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256 gaugeAfter = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        assertLt(gaugeAfter, gaugeBefore, "Gauge balance should decrease after removeAndBurnOTokens");
    }

    // ─── removeOnlyAssets (pool tilted to hardAsset) ─────────────────

    function test_removeOnlyAssets_improvesPoolBalance() public {
        _depositToStrategy(500_000e6);
        _ensurePoolExcessHardAsset(1_000_000 ether);

        uint256[] memory balancesBefore = curveAMOStrategy.curvePool().get_balances();
        int256 diffBefore = int256(balancesBefore[curveAMOStrategy.hardAssetCoinIndex()] * 1e12)
            - int256(balancesBefore[curveAMOStrategy.otokenCoinIndex()]);

        uint256 gaugeBalance = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256[] memory balancesAfter = curveAMOStrategy.curvePool().get_balances();
        int256 diffAfter = int256(balancesAfter[curveAMOStrategy.hardAssetCoinIndex()] * 1e12)
            - int256(balancesAfter[curveAMOStrategy.otokenCoinIndex()]);

        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after removeOnlyAssets");
    }

    function test_removeOnlyAssets_transfersToVault() public {
        _depositToStrategy(500_000e6);
        _ensurePoolExcessHardAsset(1_000_000 ether);

        uint256 vaultBalanceBefore = usdc.balanceOf(address(ousdVault));

        uint256 gaugeBalance = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256 vaultBalanceAfter = usdc.balanceOf(address(ousdVault));
        assertGt(vaultBalanceAfter, vaultBalanceBefore, "Vault should receive USDC from removeOnlyAssets");
    }

    function test_removeOnlyAssets_checkBalanceDecreases() public {
        _depositToStrategy(500_000e6);
        _ensurePoolExcessHardAsset(1_000_000 ether);

        uint256 balanceBefore = curveAMOStrategy.checkBalance(address(usdc));

        uint256 gaugeBalance = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256 balanceAfter = curveAMOStrategy.checkBalance(address(usdc));
        assertLt(balanceAfter, balanceBefore, "checkBalance should decrease after removeOnlyAssets");
    }

    function test_removeOnlyAssets_oTokenSupplyUnchanged() public {
        _depositToStrategy(500_000e6);
        _ensurePoolExcessHardAsset(1_000_000 ether);

        uint256 supplyBefore = IERC20(address(ousd)).totalSupply();

        uint256 gaugeBalance = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256 supplyAfter = IERC20(address(ousd)).totalSupply();
        assertEq(supplyAfter, supplyBefore, "OUSD supply should not change");
    }

    // ─── Lifecycle ───────────────────────────────────────────────────

    function test_lifecycle_deposit_rebalance_withdraw() public {
        _seedVaultForSolvency(10_000_000e6);
        _depositToStrategy(500_000e6);
        _ensurePoolExcessHardAsset(1_000_000 ether);

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(250_000 ether);

        vm.prank(address(ousdVault));
        curveAMOStrategy.withdrawAll();

        assertApproxEqAbs(
            curveAMOStrategy.checkBalance(address(usdc)),
            0,
            1e6,
            "checkBalance should be ~0 after full lifecycle"
        );
    }
}
