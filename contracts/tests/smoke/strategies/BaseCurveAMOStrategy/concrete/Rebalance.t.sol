// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_BaseCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Smoke_Concrete_BaseCurveAMOStrategy_Rebalance_Test is Smoke_BaseCurveAMOStrategy_Shared_Test {
    // ─── mintAndAddOTokens (pool tilted to WETH) ─────────────────────

    function test_mintAndAddOTokens_improvesPoolBalance() public {
        _seedVaultForSolvency(10_000 ether);
        _ensurePoolExcessWeth(1000 ether);

        uint256[] memory balancesBefore = baseCurveAMOStrategy.curvePool().get_balances();
        int256 diffBefore = int256(balancesBefore[baseCurveAMOStrategy.wethCoinIndex()])
            - int256(balancesBefore[baseCurveAMOStrategy.oethCoinIndex()]);

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(500 ether);

        uint256[] memory balancesAfter = baseCurveAMOStrategy.curvePool().get_balances();
        int256 diffAfter = int256(balancesAfter[baseCurveAMOStrategy.wethCoinIndex()])
            - int256(balancesAfter[baseCurveAMOStrategy.oethCoinIndex()]);

        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after mintAndAddOTokens");
    }

    function test_mintAndAddOTokens_gaugeBalanceIncreases() public {
        _seedVaultForSolvency(10_000 ether);
        _ensurePoolExcessWeth(1000 ether);

        uint256 gaugeBefore = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(500 ether);

        uint256 gaugeAfter = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        assertGt(gaugeAfter, gaugeBefore, "Gauge balance should increase after mintAndAddOTokens");
    }

    function test_mintAndAddOTokens_checkBalanceIncreases() public {
        _seedVaultForSolvency(10_000 ether);
        _ensurePoolExcessWeth(1000 ether);

        uint256 balanceBefore = baseCurveAMOStrategy.checkBalance(address(weth));

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(500 ether);

        uint256 balanceAfter = baseCurveAMOStrategy.checkBalance(address(weth));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after mintAndAddOTokens");
    }

    function test_mintAndAddOTokens_noResidualTokens() public {
        _seedVaultForSolvency(10_000 ether);
        _ensurePoolExcessWeth(1000 ether);

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(500 ether);

        assertEq(
            IERC20(address(oethBase)).balanceOf(address(baseCurveAMOStrategy)),
            0,
            "No residual OETHb on strategy"
        );
        assertEq(weth.balanceOf(address(baseCurveAMOStrategy)), 0, "No residual WETH on strategy");
    }

    // ─── removeAndBurnOTokens (pool tilted to OETHb) ─────────────────

    function test_removeAndBurnOTokens_improvesPoolBalance() public {
        _depositToStrategy(50 ether);
        _ensurePoolExcessOeth(1000 ether);

        uint256[] memory balancesBefore = baseCurveAMOStrategy.curvePool().get_balances();
        int256 diffBefore = int256(balancesBefore[baseCurveAMOStrategy.oethCoinIndex()])
            - int256(balancesBefore[baseCurveAMOStrategy.wethCoinIndex()]);

        uint256 gaugeBalance = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 10;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256[] memory balancesAfter = baseCurveAMOStrategy.curvePool().get_balances();
        int256 diffAfter = int256(balancesAfter[baseCurveAMOStrategy.oethCoinIndex()])
            - int256(balancesAfter[baseCurveAMOStrategy.wethCoinIndex()]);

        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after removeAndBurnOTokens");
    }

    function test_removeAndBurnOTokens_oTokenSupplyDecreases() public {
        _depositToStrategy(50 ether);
        _ensurePoolExcessOeth(1000 ether);

        uint256 supplyBefore = IERC20(address(oethBase)).totalSupply();

        uint256 gaugeBalance = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 10;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256 supplyAfter = IERC20(address(oethBase)).totalSupply();
        assertLt(supplyAfter, supplyBefore, "OETHb totalSupply should decrease");
    }

    function test_removeAndBurnOTokens_gaugeBalanceDecreases() public {
        _depositToStrategy(50 ether);
        _ensurePoolExcessOeth(1000 ether);

        uint256 gaugeBefore = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        uint256 lpToRemove = gaugeBefore / 10;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256 gaugeAfter = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        assertLt(gaugeAfter, gaugeBefore, "Gauge balance should decrease after removeAndBurnOTokens");
    }

    // ─── removeOnlyAssets (pool tilted to WETH) ──────────────────────

    function test_removeOnlyAssets_improvesPoolBalance() public {
        _depositToStrategy(500 ether);
        _ensurePoolExcessWeth(1000 ether);

        uint256[] memory balancesBefore = baseCurveAMOStrategy.curvePool().get_balances();
        int256 diffBefore = int256(balancesBefore[baseCurveAMOStrategy.wethCoinIndex()])
            - int256(balancesBefore[baseCurveAMOStrategy.oethCoinIndex()]);

        uint256 gaugeBalance = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256[] memory balancesAfter = baseCurveAMOStrategy.curvePool().get_balances();
        int256 diffAfter = int256(balancesAfter[baseCurveAMOStrategy.wethCoinIndex()])
            - int256(balancesAfter[baseCurveAMOStrategy.oethCoinIndex()]);

        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after removeOnlyAssets");
    }

    function test_removeOnlyAssets_transfersToVault() public {
        _depositToStrategy(500 ether);
        _ensurePoolExcessWeth(1000 ether);

        uint256 vaultBalanceBefore = weth.balanceOf(address(oethBaseVault));

        uint256 gaugeBalance = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256 vaultBalanceAfter = weth.balanceOf(address(oethBaseVault));
        assertGt(vaultBalanceAfter, vaultBalanceBefore, "Vault should receive WETH from removeOnlyAssets");
    }

    function test_removeOnlyAssets_checkBalanceDecreases() public {
        _depositToStrategy(500 ether);
        _ensurePoolExcessWeth(1000 ether);

        uint256 balanceBefore = baseCurveAMOStrategy.checkBalance(address(weth));

        uint256 gaugeBalance = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256 balanceAfter = baseCurveAMOStrategy.checkBalance(address(weth));
        assertLt(balanceAfter, balanceBefore, "checkBalance should decrease after removeOnlyAssets");
    }

    function test_removeOnlyAssets_oTokenSupplyUnchanged() public {
        _depositToStrategy(500 ether);
        _ensurePoolExcessWeth(1000 ether);

        uint256 supplyBefore = IERC20(address(oethBase)).totalSupply();

        uint256 gaugeBalance = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256 supplyAfter = IERC20(address(oethBase)).totalSupply();
        assertEq(supplyAfter, supplyBefore, "OETHb supply should not change");
    }

    // ─── Lifecycle ───────────────────────────────────────────────────

    function test_lifecycle_deposit_rebalance_withdraw() public {
        _seedVaultForSolvency(10_000 ether);
        _depositToStrategy(500 ether);
        _ensurePoolExcessWeth(1000 ether);

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(250 ether);

        vm.prank(address(oethBaseVault));
        baseCurveAMOStrategy.withdrawAll();

        assertApproxEqAbs(
            baseCurveAMOStrategy.checkBalance(address(weth)),
            0,
            0.001 ether,
            "checkBalance should be ~0 after full lifecycle"
        );
    }
}
