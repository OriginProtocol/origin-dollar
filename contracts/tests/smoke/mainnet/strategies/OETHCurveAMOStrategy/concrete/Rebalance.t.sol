// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Smoke_Concrete_OETHCurveAMOStrategy_Rebalance_Test is Smoke_OETHCurveAMOStrategy_Shared_Test {
    // ─── mintAndAddOTokens (pool tilted to hardAsset) ────────────────

    function test_mintAndAddOTokens_improvesPoolBalance() public {
        _seedVaultForSolvency(10_000 ether);
        _ensurePoolExcessHardAsset(1000 ether);

        uint256[] memory balancesBefore = curvePool.get_balances();
        int256 diffBefore = int256(balancesBefore[curveAMOStrategy.hardAssetCoinIndex()])
            - int256(balancesBefore[curveAMOStrategy.otokenCoinIndex()]);

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(500 ether);

        uint256[] memory balancesAfter = curvePool.get_balances();
        int256 diffAfter = int256(balancesAfter[curveAMOStrategy.hardAssetCoinIndex()])
            - int256(balancesAfter[curveAMOStrategy.otokenCoinIndex()]);

        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after mintAndAddOTokens");
    }

    function test_mintAndAddOTokens_gaugeBalanceIncreases() public {
        _seedVaultForSolvency(10_000 ether);
        _ensurePoolExcessHardAsset(1000 ether);

        uint256 gaugeBefore = gauge.balanceOf(address(curveAMOStrategy));

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(500 ether);

        uint256 gaugeAfter = gauge.balanceOf(address(curveAMOStrategy));
        assertGt(gaugeAfter, gaugeBefore, "Gauge balance should increase after mintAndAddOTokens");
    }

    function test_mintAndAddOTokens_checkBalanceIncreases() public {
        _seedVaultForSolvency(10_000 ether);
        _ensurePoolExcessHardAsset(1000 ether);

        uint256 balanceBefore = curveAMOStrategy.checkBalance(address(weth));

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(500 ether);

        uint256 balanceAfter = curveAMOStrategy.checkBalance(address(weth));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after mintAndAddOTokens");
    }

    function test_mintAndAddOTokens_noResidualTokens() public {
        _seedVaultForSolvency(10_000 ether);
        _ensurePoolExcessHardAsset(1000 ether);

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(500 ether);

        assertEq(IERC20(address(oeth)).balanceOf(address(curveAMOStrategy)), 0, "No residual OETH on strategy");
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0, "No residual WETH on strategy");
    }

    // ─── removeAndBurnOTokens (pool tilted to oToken) ────────────────

    function test_removeAndBurnOTokens_improvesPoolBalance() public {
        _depositToStrategy(50 ether);
        _ensurePoolExcessOToken(1000 ether);

        uint256[] memory balancesBefore = curvePool.get_balances();
        int256 diffBefore = int256(balancesBefore[curveAMOStrategy.otokenCoinIndex()])
            - int256(balancesBefore[curveAMOStrategy.hardAssetCoinIndex()]);

        uint256 gaugeBalance = gauge.balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = _boundedBurnLpAmount(gaugeBalance);

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256[] memory balancesAfter = curvePool.get_balances();
        int256 diffAfter = int256(balancesAfter[curveAMOStrategy.otokenCoinIndex()])
            - int256(balancesAfter[curveAMOStrategy.hardAssetCoinIndex()]);

        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after removeAndBurnOTokens");
    }

    function test_removeAndBurnOTokens_oTokenSupplyDecreases() public {
        _depositToStrategy(50 ether);
        _ensurePoolExcessOToken(1000 ether);

        uint256 supplyBefore = IERC20(address(oeth)).totalSupply();

        uint256 gaugeBalance = gauge.balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = _boundedBurnLpAmount(gaugeBalance);

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256 supplyAfter = IERC20(address(oeth)).totalSupply();
        assertLt(supplyAfter, supplyBefore, "OETH totalSupply should decrease");
    }

    function test_removeAndBurnOTokens_gaugeBalanceDecreases() public {
        _depositToStrategy(50 ether);
        _ensurePoolExcessOToken(1000 ether);

        uint256 gaugeBefore = gauge.balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = _boundedBurnLpAmount(gaugeBefore);

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256 gaugeAfter = gauge.balanceOf(address(curveAMOStrategy));
        assertLt(gaugeAfter, gaugeBefore, "Gauge balance should decrease after removeAndBurnOTokens");
    }

    // ─── removeOnlyAssets (pool tilted to hardAsset) ─────────────────

    function test_removeOnlyAssets_improvesPoolBalance() public {
        _depositToStrategy(500 ether);
        _ensurePoolExcessHardAsset(1000 ether);

        uint256[] memory balancesBefore = curvePool.get_balances();
        int256 diffBefore = int256(balancesBefore[curveAMOStrategy.hardAssetCoinIndex()])
            - int256(balancesBefore[curveAMOStrategy.otokenCoinIndex()]);

        uint256 gaugeBalance = gauge.balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256[] memory balancesAfter = curvePool.get_balances();
        int256 diffAfter = int256(balancesAfter[curveAMOStrategy.hardAssetCoinIndex()])
            - int256(balancesAfter[curveAMOStrategy.otokenCoinIndex()]);

        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after removeOnlyAssets");
    }

    function test_removeOnlyAssets_transfersToVault() public {
        _depositToStrategy(500 ether);
        _ensurePoolExcessHardAsset(1000 ether);

        uint256 vaultBalanceBefore = weth.balanceOf(address(oethVault));

        uint256 gaugeBalance = gauge.balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256 vaultBalanceAfter = weth.balanceOf(address(oethVault));
        assertGt(vaultBalanceAfter, vaultBalanceBefore, "Vault should receive WETH from removeOnlyAssets");
    }

    function test_removeOnlyAssets_checkBalanceDecreases() public {
        _depositToStrategy(500 ether);
        _ensurePoolExcessHardAsset(1000 ether);

        uint256 balanceBefore = curveAMOStrategy.checkBalance(address(weth));

        uint256 gaugeBalance = gauge.balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256 balanceAfter = curveAMOStrategy.checkBalance(address(weth));
        assertLt(balanceAfter, balanceBefore, "checkBalance should decrease after removeOnlyAssets");
    }

    function test_removeOnlyAssets_oTokenSupplyUnchanged() public {
        _depositToStrategy(500 ether);
        _ensurePoolExcessHardAsset(1000 ether);

        uint256 supplyBefore = IERC20(address(oeth)).totalSupply();

        uint256 gaugeBalance = gauge.balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalance / 20;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256 supplyAfter = IERC20(address(oeth)).totalSupply();
        assertEq(supplyAfter, supplyBefore, "OETH supply should not change");
    }

    // ─── Lifecycle ───────────────────────────────────────────────────

    function test_lifecycle_deposit_rebalance_withdraw() public {
        _seedVaultForSolvency(10_000 ether);
        _depositToStrategy(500 ether);
        _ensurePoolExcessHardAsset(1000 ether);

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(250 ether);

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        assertApproxEqAbs(
            curveAMOStrategy.checkBalance(address(weth)),
            0,
            0.001 ether,
            "checkBalance should be ~0 after full lifecycle"
        );
    }

    function _boundedBurnLpAmount(uint256 gaugeBalance) internal pure returns (uint256) {
        uint256 lpToRemove = gaugeBalance / 100;
        return lpToRemove == 0 ? 1 : lpToRemove;
    }
}
