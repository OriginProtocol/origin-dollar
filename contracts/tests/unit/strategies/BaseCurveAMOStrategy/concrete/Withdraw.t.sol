// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_Withdraw_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_withdraw_removesLiquidityAndTransfers() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        address recipient = address(oethVault);
        uint256 recipientBalBefore = weth.balanceOf(recipient);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdraw(recipient, address(weth), withdrawAmount);

        assertEq(weth.balanceOf(recipient) - recipientBalBefore, withdrawAmount);
    }

    function test_withdraw_burnsOTokens() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), withdrawAmount);

        assertLt(oeth.totalSupply(), supplyBefore);
    }

    function test_withdraw_emitsWithdrawalEvents() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        vm.expectEmit(true, true, true, true);
        emit InitializableAbstractStrategy.Withdrawal(address(weth), address(curvePool), withdrawAmount);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), withdrawAmount);
    }

    function test_withdraw_emitsOethWithdrawalEvent() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.expectEmit(true, true, false, false);
        emit InitializableAbstractStrategy.Withdrawal(address(oeth), address(curvePool), 0);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);
    }

    function test_withdraw_assertsSolvency() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);

        uint256 totalValue = oethVault.totalValue();
        uint256 totalSupply = oeth.totalSupply();
        assertGe(totalValue * 1e18 / totalSupply, 0.998 ether);
    }

    function test_withdraw_calcTokenToBurn_computesCorrectly() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        uint256 gaugeBefore = curveGauge.balanceOf(address(baseCurveAMOStrategy));

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), 3 ether);

        uint256 gaugeAfter = curveGauge.balanceOf(address(baseCurveAMOStrategy));
        uint256 lpBurned = gaugeBefore - gaugeAfter;

        assertGt(lpBurned, 0);
        assertLt(lpBurned, gaugeBefore);
    }

    function test_withdraw_RevertWhen_amountIsZero() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must withdraw something");
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), 0);
    }

    function test_withdraw_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Can only withdraw WETH");
        baseCurveAMOStrategy.withdraw(address(oethVault), address(oeth), 1 ether);
    }

    function test_withdraw_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), 1 ether);
    }

    function test_withdraw_RevertWhen_insufficientLPTokens() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(1 ether);

        vm.prank(address(oethVault));
        vm.expectRevert(); // gauge underflow on withdraw
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), 100 ether);
    }

    function test_withdraw_RevertWhen_protocolInsolvent() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(address(oethVault));
        oeth.mint(alice, 10_000 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Protocol insolvent");
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);
    }
}
