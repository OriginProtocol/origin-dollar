// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";
import {ICurveAMOStrategy} from "contracts/interfaces/strategies/ICurveAMOStrategy.sol";

contract Unit_Concrete_CurveAMOStrategy_WithdrawAll_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_withdrawAll_withdrawsEverything() public {
        uint256 depositAmount = 10 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), 0);

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(curvePool.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_withdrawAll_burnsAllOTokens() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        // Strategy should have no OTokens left
        assertEq(oeth.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_withdrawAll_noOpWhenNoLPTokens() public {
        // No deposit — withdrawAll should not revert
        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_withdrawAll_calledByGovernor() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(governor);
        curveAMOStrategy.withdrawAll();

        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_withdrawAll_emitsHardAssetWithdrawal() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Expect Withdrawal event for hardAsset (hardAssetBalance > 0)
        vm.expectEmit(true, true, false, false);
        emit ICurveAMOStrategy.Withdrawal(address(weth), address(curvePool), 0);

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();
    }

    function test_withdrawAll_emitsOTokenWithdrawal() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Expect Withdrawal event for oToken (otokenToBurn > 0)
        vm.expectEmit(true, true, false, false);
        emit ICurveAMOStrategy.Withdrawal(address(oeth), address(curvePool), 0);

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();
    }

    function test_withdrawAll_transfersHardAssetToVault() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        uint256 vaultBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        // hardAsset transferred back to vault
        assertGt(weth.balanceOf(address(oethVault)), vaultBefore);
    }

    function test_withdrawAll_RevertWhen_calledByNonVaultOrGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault or Governor");
        curveAMOStrategy.withdrawAll();
    }
}
