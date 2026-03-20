// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_WithdrawAll_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_withdrawAll_withdrawsEverything() public {
        uint256 depositAmount = 10 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        assertGt(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdrawAll();

        assertEq(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
        assertEq(curvePool.balanceOf(address(baseCurveAMOStrategy)), 0);
        assertEq(weth.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_withdrawAll_burnsAllOTokens() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdrawAll();

        assertEq(oeth.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_withdrawAll_noOpWhenNoLPTokens() public {
        // BaseCurveAMOStrategy returns early when gaugeTokens == 0
        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdrawAll();

        assertEq(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_withdrawAll_calledByGovernor() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(governor);
        baseCurveAMOStrategy.withdrawAll();

        assertEq(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_withdrawAll_emitsWethWithdrawal() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.expectEmit(true, true, false, false);
        emit InitializableAbstractStrategy.Withdrawal(address(weth), address(curvePool), 0);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdrawAll();
    }

    function test_withdrawAll_emitsOethWithdrawal() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.expectEmit(true, true, false, false);
        emit InitializableAbstractStrategy.Withdrawal(address(oeth), address(curvePool), 0);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdrawAll();
    }

    function test_withdrawAll_transfersWethToVault() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        uint256 vaultBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdrawAll();

        assertGt(weth.balanceOf(address(oethVault)), vaultBefore);
    }

    function test_withdrawAll_RevertWhen_calledByNonVaultOrGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault or Governor");
        baseCurveAMOStrategy.withdrawAll();
    }
}
