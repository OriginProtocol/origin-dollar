// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_BaseBridgeHelperModule_Shared_Test
} from "tests/fork/base/automation/BaseBridgeHelperModule/shared/Shared.t.sol";

contract Fork_Concrete_BaseBridgeHelperModule_DepositWETHAndRedeemWOETH_Test is
    Fork_BaseBridgeHelperModule_Shared_Test
{
    function test_depositWETHAndRedeemWOETH() public {
        uint256 wethAmount = 1 ether;
        _fundWithWETH(safeSigner, wethAmount);

        // Update oracle price and rebase
        bridgedWOETHStrategy.updateWOETHOraclePrice();
        vault.rebase();

        uint256 wethPerUnitWOETH = bridgedWOETHStrategy.getBridgedWOETHValue(1 ether);
        uint256 expectedWOETHAmount = (wethAmount * 1 ether) / wethPerUnitWOETH;

        uint256 supplyBefore = oethBase.totalSupply();
        uint256 wethBalanceBefore = weth.balanceOf(safeSigner);
        uint256 woethBalanceBefore = bridgedWoeth.balanceOf(safeSigner);
        uint256 woethStrategyBalanceBefore = bridgedWoeth.balanceOf(address(bridgedWOETHStrategy));
        uint256 woethStrategyValueBefore = bridgedWOETHStrategy.checkBalance(address(weth));

        // Deposit WETH for OETHb and redeem it for wOETH
        vm.prank(safeSigner);
        baseBridgeHelperModule.depositWETHAndRedeemWOETH(wethAmount);

        uint256 supplyAfter = oethBase.totalSupply();
        uint256 wethBalanceAfter = weth.balanceOf(safeSigner);
        uint256 woethBalanceAfter = bridgedWoeth.balanceOf(safeSigner);
        uint256 woethStrategyBalanceAfter = bridgedWoeth.balanceOf(address(bridgedWOETHStrategy));
        uint256 woethStrategyValueAfter = bridgedWOETHStrategy.checkBalance(address(weth));

        assertApproxEqRel(supplyAfter, supplyBefore - 1 ether, 0.01e18, "OETHb supply should decrease");
        assertEq(wethBalanceAfter, wethBalanceBefore - wethAmount, "WETH balance should decrease");
        assertEq(
            woethBalanceAfter, woethBalanceBefore + expectedWOETHAmount, "wOETH balance should increase by expected"
        );
        assertApproxEqRel(
            woethStrategyBalanceAfter,
            woethStrategyBalanceBefore - expectedWOETHAmount,
            0.01e18,
            "Strategy wOETH balance should decrease"
        );
        assertApproxEqRel(
            woethStrategyValueAfter,
            woethStrategyValueBefore - expectedWOETHAmount,
            0.01e18,
            "Strategy value should decrease"
        );
    }
}
