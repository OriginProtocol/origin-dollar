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
            vm.startPrank(alice);
            weth.approve(address(curvePool), attackerLiquidity);
            amounts[0] = attackerLiquidity;
            curvePool.add_liquidity(amounts, 0);
            vm.stopPrank();
        } else {
            vm.prank(address(oethVault));
            oeth.mint(alice, attackerLiquidity);
            vm.startPrank(alice);
            oeth.approve(address(curvePool), attackerLiquidity);
            amounts[1] = attackerLiquidity;
            curvePool.add_liquidity(amounts, 0);
            vm.stopPrank();
        }

        uint256 attackerLpTokens = curvePool.balanceOf(alice);
        uint256 strategyBalanceBefore = curveAMOStrategy.checkBalance(address(weth));
        uint256 totalSupplyBefore = oeth.totalSupply();

        _depositAsVault(depositAmount);

        assertGt(curveAMOStrategy.checkBalance(address(weth)), strategyBalanceBefore);
        assertGt(oeth.totalSupply(), totalSupplyBefore);

        uint256[] memory minAmounts = new uint256[](2);
        vm.prank(alice);
        curvePool.remove_liquidity(attackerLpTokens, minAmounts);

        assertGe(oethVault.totalValue(), oeth.totalSupply());

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(curvePool.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(oeth.balanceOf(address(curveAMOStrategy)), 0);
        assertGe(oethVault.totalValue(), oeth.totalSupply());
    }
}
