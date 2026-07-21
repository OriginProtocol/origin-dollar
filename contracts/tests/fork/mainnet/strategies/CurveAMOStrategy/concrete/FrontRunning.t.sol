// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_CurveAMOStrategy_Shared_Test} from "tests/fork/mainnet/strategies/CurveAMOStrategy/shared/Shared.t.sol";

contract Fork_Concrete_CurveAMOStrategy_FrontRunning_Test is Fork_CurveAMOStrategy_Shared_Test {
    function test_frontRunningDeposit_attackerAddsWethLiquidity() public {
        _runFrontRunningDepositRegression(true);
    }

    function test_frontRunningDeposit_attackerAddsOethLiquidity() public {
        _runFrontRunningDepositRegression(false);
    }

    function _runFrontRunningDepositRegression(bool attackerAddsWeth) internal {
        _depositAsVault(10 ether);

        uint256 attackerLiquidity = 300 ether;
        uint256 depositAmount = 10 ether;
        uint256[] memory amounts = new uint256[](2);

        if (attackerAddsWeth) {
            deal(address(weth), alice, attackerLiquidity);
        } else {
            vm.prank(address(oethVault));
            oeth.mint(alice, attackerLiquidity);
        }

        uint256 totalValueBefore = oethVault.totalValue();
        uint256 totalSupplyBefore = oeth.totalSupply();

        if (attackerAddsWeth) {
            vm.startPrank(alice);
            weth.approve(address(curvePool), attackerLiquidity);
            amounts[curveAMOStrategy.hardAssetCoinIndex()] = attackerLiquidity;
            curvePool.add_liquidity(amounts, 0);
            vm.stopPrank();
        } else {
            vm.startPrank(alice);
            oeth.approve(address(curvePool), attackerLiquidity);
            amounts[curveAMOStrategy.otokenCoinIndex()] = attackerLiquidity;
            curvePool.add_liquidity(amounts, 0);
            vm.stopPrank();
        }

        uint256 attackerLpTokens = curvePool.balanceOf(alice);
        uint256 strategyBalanceBefore = curveAMOStrategy.checkBalance(address(weth));

        _depositAsVault(depositAmount);

        assertGt(curveAMOStrategy.checkBalance(address(weth)), strategyBalanceBefore);
        assertGt(oeth.totalSupply(), totalSupplyBefore);

        uint256[] memory minAmounts = new uint256[](2);
        vm.prank(alice);
        curvePool.remove_liquidity(attackerLpTokens, minAmounts);

        assertGt(_protocolProfit(totalValueBefore, totalSupplyBefore), 0);

        vm.prank(strategist);
        oethVault.rebase();

        uint256 totalValueAfterRebase = oethVault.totalValue();
        uint256 totalSupplyAfterRebase = oeth.totalSupply();

        vm.prank(governor);
        oethVault.withdrawAllFromStrategy(address(curveAMOStrategy));

        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(curvePool.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(oeth.balanceOf(address(curveAMOStrategy)), 0);
        assertGe(_protocolProfit(totalValueAfterRebase, totalSupplyAfterRebase), 0);
    }

    function _protocolProfit(uint256 totalValueBefore, uint256 totalSupplyBefore) internal view returns (int256) {
        int256 totalValueDelta = int256(oethVault.totalValue()) - int256(totalValueBefore);
        int256 totalSupplyDelta = int256(oeth.totalSupply()) - int256(totalSupplyBefore);
        return totalValueDelta - totalSupplyDelta;
    }
}
