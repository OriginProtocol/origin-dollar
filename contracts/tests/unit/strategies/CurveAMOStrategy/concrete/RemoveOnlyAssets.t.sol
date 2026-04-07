// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";
import {ICurveAMOStrategy} from "contracts/interfaces/strategies/ICurveAMOStrategy.sol";

contract Unit_Concrete_CurveAMOStrategy_RemoveOnlyAssets_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_removeOnlyAssets_removesAndTransfersToVault() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);

        // Pool tilted to hardAsset so removing hardAsset improves balance
        _setupPoolBalances(200 ether, 100 ether);

        uint256 vaultBalBefore = weth.balanceOf(address(oethVault));
        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        assertGt(weth.balanceOf(address(oethVault)), vaultBalBefore);
    }

    function test_removeOnlyAssets_improvesBalance_poolTiltedToHardAsset() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);

        // Pool tilted to hardAsset
        _setupPoolBalances(200 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // Should not revert
        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_emitsWithdrawal() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(200 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.expectEmit(true, true, false, false);
        emit ICurveAMOStrategy.Withdrawal(address(weth), address(curvePool), 0);

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_RevertWhen_calledByNonStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        curveAMOStrategy.removeOnlyAssets(1 ether);
    }

    function test_removeOnlyAssets_RevertWhen_poolTiltedToOToken() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Pool tilted to OToken (diffBefore < 0) — removing hardAsset worsens OToken balance
        _setupPoolBalances(100 ether, 200 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        curveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_RevertWhen_insufficientLPTokens() public {
        _setupPoolBalances(200 ether, 100 ether);

        vm.prank(strategist);
        vm.expectRevert("Insufficient LP tokens");
        curveAMOStrategy.removeOnlyAssets(1 ether);
    }

    function test_removeOnlyAssets_RevertWhen_poolBalanced() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Pool balanced: diffBefore == 0
        _setupPoolBalances(100 ether, 100 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Position balance is worsened");
        curveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_RevertWhen_overshootsToPeg() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(50 ether);

        // Pool slightly tilted to hardAsset (diffBefore > 0, small)
        _setupPoolBalances(100 ether, 99 ether);

        // Removing lots of hardAsset overshoots to OToken side (diffAfter < 0)
        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 2;

        vm.prank(strategist);
        vm.expectRevert("Assets overshot peg");
        curveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_RevertWhen_protocolInsolvent() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Pool tilted to hardAsset (so improvePoolBalance passes)
        _setupPoolBalances(200 ether, 100 ether);

        // Inflate supply massively
        vm.prank(address(oethVault));
        oeth.mint(alice, 100_000 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        curveAMOStrategy.removeOnlyAssets(lpToRemove);
    }
}
