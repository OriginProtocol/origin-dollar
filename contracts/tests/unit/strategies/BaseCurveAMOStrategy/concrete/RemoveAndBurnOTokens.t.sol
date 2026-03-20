// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_RemoveAndBurnOTokens_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_removeAndBurnOTokens_removesAndBurns() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Tilt pool to OToken so removing OTokens improves balance
        _setupPoolBalances(100 ether, 200 ether);

        uint256 supplyBefore = oeth.totalSupply();
        uint256 gaugeBalBefore = curveGauge.balanceOf(address(baseCurveAMOStrategy));
        uint256 lpToRemove = gaugeBalBefore / 4;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        assertLt(oeth.totalSupply(), supplyBefore);
        assertLt(curveGauge.balanceOf(address(baseCurveAMOStrategy)), gaugeBalBefore);
    }

    function test_removeAndBurnOTokens_improvesBalance_poolTiltedToOeth() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 200 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_emitsWithdrawal() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 200 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.expectEmit(true, true, false, false);
        emit InitializableAbstractStrategy.Withdrawal(address(oeth), address(curvePool), 0);

        vm.prank(strategist);
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_RevertWhen_calledByNonStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        baseCurveAMOStrategy.removeAndBurnOTokens(1 ether);
    }

    function test_removeAndBurnOTokens_RevertWhen_poolTiltedToWeth() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(200 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_RevertWhen_poolBalanced() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Position balance is worsened");
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_RevertWhen_overshootsToPeg() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(50 ether);

        // Pool slightly tilted to OToken
        _setupPoolBalances(99 ether, 100 ether);

        // Removing lots of OTokens overshoots to weth side
        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 2;

        vm.prank(strategist);
        vm.expectRevert("OTokens overshot peg");
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_RevertWhen_protocolInsolvent() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 200 ether);

        vm.prank(address(oethVault));
        oeth.mint(alice, 100_000 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }
}
