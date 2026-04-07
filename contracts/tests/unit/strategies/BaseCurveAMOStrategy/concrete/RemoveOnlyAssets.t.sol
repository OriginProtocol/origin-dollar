// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";
import {IBaseCurveAMOStrategy} from "contracts/interfaces/strategies/IBaseCurveAMOStrategy.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_RemoveOnlyAssets_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_removeOnlyAssets_removesAndTransfersToVault() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);

        // Pool tilted to weth so removing weth improves balance
        _setupPoolBalances(200 ether, 100 ether);

        uint256 vaultBalBefore = weth.balanceOf(address(oethVault));
        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);

        assertGt(weth.balanceOf(address(oethVault)), vaultBalBefore);
    }

    function test_removeOnlyAssets_improvesBalance_poolTiltedToWeth() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(200 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_emitsWithdrawal() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(200 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.expectEmit(true, true, false, false);
        emit IBaseCurveAMOStrategy.Withdrawal(address(weth), address(curvePool), 0);

        vm.prank(strategist);
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_RevertWhen_calledByNonStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        baseCurveAMOStrategy.removeOnlyAssets(1 ether);
    }

    function test_removeOnlyAssets_RevertWhen_poolTiltedToOeth() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 200 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_RevertWhen_poolBalanced() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Position balance is worsened");
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_RevertWhen_overshootsToPeg() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(50 ether);

        // Pool slightly tilted to weth
        _setupPoolBalances(100 ether, 99 ether);

        // Removing lots of weth overshoots to OToken side
        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 2;

        vm.prank(strategist);
        vm.expectRevert("Assets overshot peg");
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_RevertWhen_protocolInsolvent() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(200 ether, 100 ether);

        vm.prank(address(oethVault));
        oeth.mint(alice, 100_000 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);
    }
}
