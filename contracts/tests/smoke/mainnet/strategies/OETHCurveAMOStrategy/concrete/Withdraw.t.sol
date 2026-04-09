// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_OETHCurveAMOStrategy_Withdraw_Test is Smoke_OETHCurveAMOStrategy_Shared_Test {
    function test_withdraw_sendsWethToVault() public {
        _depositToStrategy(10 ether);

        uint256 vaultBalanceBefore = weth.balanceOf(address(oethVault));
        uint256 withdrawAmount = 1 ether;

        vm.prank(address(oethVault));
        curveAMOStrategy.withdraw(address(oethVault), address(weth), withdrawAmount);

        uint256 vaultBalanceAfter = weth.balanceOf(address(oethVault));
        assertApproxEqAbs(
            vaultBalanceAfter - vaultBalanceBefore,
            withdrawAmount,
            0.05 ether,
            "Vault should receive ~withdrawAmount WETH"
        );
    }

    function test_withdraw_decreasesCheckBalance() public {
        _depositToStrategy(10 ether);

        uint256 balanceBefore = curveAMOStrategy.checkBalance(address(weth));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdraw(address(oethVault), address(weth), 1 ether);

        uint256 balanceAfter = curveAMOStrategy.checkBalance(address(weth));
        assertLt(balanceAfter, balanceBefore, "checkBalance should decrease after withdrawal");
    }

    function test_withdrawAll_returnsAllWethToVault() public {
        uint256 vaultBalanceBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        uint256 vaultBalanceAfter = weth.balanceOf(address(oethVault));
        assertGt(vaultBalanceAfter - vaultBalanceBefore, 0, "Vault should receive WETH from withdrawAll");
        assertApproxEqAbs(
            curveAMOStrategy.checkBalance(address(weth)), 0, 0.001 ether, "checkBalance should be ~0 after withdrawAll"
        );
    }

    function test_withdrawAndRedeposit_cycle() public {
        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        uint256 balanceAfterWithdraw = curveAMOStrategy.checkBalance(address(weth));
        assertApproxEqAbs(balanceAfterWithdraw, 0, 0.001 ether, "Should be ~0 after withdrawAll");

        _depositToStrategy(5 ether);

        uint256 balanceAfterRedeposit = curveAMOStrategy.checkBalance(address(weth));
        assertGt(balanceAfterRedeposit, 4 ether, "checkBalance should reflect redeposited funds");
    }
}
