// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_CurveAMOStrategyOUSD_Shared_Test
} from "tests/fork/mainnet/strategies/CurveAMOStrategyOUSD/shared/Shared.t.sol";

contract Fork_Concrete_CurveAMOStrategyOUSD_FrontRunning_Test is Fork_CurveAMOStrategyOUSD_Shared_Test {
    function test_frontRunningDeposit_attackerAddsUsdcLiquidity() public {
        _runFrontRunningDepositRegression(true);
    }

    function test_frontRunningDeposit_attackerAddsOusdLiquidity() public {
        _runFrontRunningDepositRegression(false);
    }

    function _runFrontRunningDepositRegression(bool attackerAddsUsdc) internal {
        _depositAsVault(10e6);

        uint256 attackerLiquidity18 = 300 ether;
        uint256 attackerUsdcLiquidity = attackerLiquidity18 / USDC_SCALE;
        uint256 depositAmount = 10e6;
        uint256[] memory amounts = new uint256[](2);

        if (attackerAddsUsdc) {
            deal(address(usdc), alice, attackerUsdcLiquidity);
        } else {
            vm.prank(address(ousdVault));
            ousd.mint(alice, attackerLiquidity18);
        }

        uint256 totalValueBefore = ousdVault.totalValue();
        uint256 totalSupplyBefore = ousd.totalSupply();

        vm.startPrank(alice);
        if (attackerAddsUsdc) {
            usdc.approve(address(curvePool), attackerUsdcLiquidity);
            amounts[curveAMOStrategy.hardAssetCoinIndex()] = attackerUsdcLiquidity;
        } else {
            ousd.approve(address(curvePool), attackerLiquidity18);
            amounts[curveAMOStrategy.otokenCoinIndex()] = attackerLiquidity18;
        }
        curvePool.add_liquidity(amounts, 0);
        vm.stopPrank();

        uint256 attackerLpTokens = curvePool.balanceOf(alice);
        uint256 strategyBalanceBefore = curveAMOStrategy.checkBalance(address(usdc));

        _depositAsVault(depositAmount);

        assertGt(curveAMOStrategy.checkBalance(address(usdc)), strategyBalanceBefore);
        assertGt(ousd.totalSupply(), totalSupplyBefore);

        uint256[] memory minAmounts = new uint256[](2);
        vm.prank(alice);
        curvePool.remove_liquidity(attackerLpTokens, minAmounts);

        assertGt(_protocolProfit(totalValueBefore, totalSupplyBefore), 0);

        vm.prank(strategist);
        ousdVault.rebase();

        uint256 totalValueAfterRebase = ousdVault.totalValue();
        uint256 totalSupplyAfterRebase = ousd.totalSupply();

        vm.prank(governor);
        ousdVault.withdrawAllFromStrategy(address(curveAMOStrategy));

        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(curvePool.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(usdc.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(ousd.balanceOf(address(curveAMOStrategy)), 0);
        assertGe(_protocolProfit(totalValueAfterRebase, totalSupplyAfterRebase), 0);
    }

    function _protocolProfit(uint256 totalValueBefore, uint256 totalSupplyBefore) internal view returns (int256) {
        int256 totalValueDelta = int256(ousdVault.totalValue()) - int256(totalValueBefore);
        int256 totalSupplyDelta = int256(ousd.totalSupply()) - int256(totalSupplyBefore);
        return totalValueDelta - totalSupplyDelta;
    }
}
