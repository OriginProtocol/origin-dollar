// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_CurveAMOStrategy_RemoveAndBurnOTokens_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_removeAndBurnOTokens_removesAndBurns() public {
        _seedVaultForSolvency(1000 ether);
        // Deposit first to have LP tokens
        _depositAsVault(20 ether);

        // Tilt pool to OToken so removing OTokens improves balance
        _setupPoolBalances(100 ether, 200 ether);

        uint256 supplyBefore = oeth.totalSupply();
        uint256 gaugeBalBefore = curveGauge.balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBalBefore / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        assertLt(oeth.totalSupply(), supplyBefore);
        assertLt(curveGauge.balanceOf(address(curveAMOStrategy)), gaugeBalBefore);
    }

    function test_removeAndBurnOTokens_improvesBalance_poolTiltedToOToken() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Pool tilted to OToken
        _setupPoolBalances(100 ether, 200 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // Should not revert — removing OTokens improves balance
        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_emitsWithdrawal() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 200 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // The exact amount emitted depends on pool math, just check event is emitted
        vm.expectEmit(true, true, false, false);
        emit InitializableAbstractStrategy.Withdrawal(address(oeth), address(curvePool), 0);

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_RevertWhen_calledByNonStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        curveAMOStrategy.removeAndBurnOTokens(1 ether);
    }

    function test_removeAndBurnOTokens_RevertWhen_poolTiltedToHardAsset() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);

        // Pool tilted to hardAsset — removing OTokens would worsen balance
        _setupPoolBalances(200 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_RevertWhen_insufficientLPTokens() public {
        // No deposit — no LP tokens
        _setupPoolBalances(100 ether, 200 ether);

        vm.prank(strategist);
        vm.expectRevert("Insufficient LP tokens");
        curveAMOStrategy.removeAndBurnOTokens(1 ether);
    }

    function test_removeAndBurnOTokens_RevertWhen_poolBalanced() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Pool balanced: diffBefore == 0
        _setupPoolBalances(100 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Position balance is worsened");
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_RevertWhen_overshootsToPeg() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(50 ether);

        // Pool slightly tilted to OToken (diffBefore < 0, small)
        _setupPoolBalances(99 ether, 100 ether);

        // Removing lots of OTokens overshoots to hardAsset side (diffAfter > 0)
        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 2;

        vm.prank(strategist);
        vm.expectRevert("OTokens overshot peg");
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_RevertWhen_protocolInsolvent() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Pool tilted to OToken (so improvePoolBalance passes)
        _setupPoolBalances(100 ether, 200 ether);

        // Inflate supply massively
        vm.prank(address(oethVault));
        oeth.mint(alice, 100_000 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }
}
