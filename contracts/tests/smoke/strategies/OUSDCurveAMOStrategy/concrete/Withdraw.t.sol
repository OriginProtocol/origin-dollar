// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSDCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_OUSDCurveAMOStrategy_Withdraw_Test is Smoke_OUSDCurveAMOStrategy_Shared_Test {
    function test_withdraw_sendsUsdcToVault() public {
        _depositToStrategy(10_000e6);

        uint256 vaultBalanceBefore = usdc.balanceOf(address(ousdVault));
        uint256 withdrawAmount = 1_000e6;

        vm.prank(address(ousdVault));
        curveAMOStrategy.withdraw(address(ousdVault), address(usdc), withdrawAmount);

        uint256 vaultBalanceAfter = usdc.balanceOf(address(ousdVault));
        assertApproxEqAbs(
            vaultBalanceAfter - vaultBalanceBefore, withdrawAmount, 50e6, "Vault should receive ~withdrawAmount USDC"
        );
    }

    function test_withdraw_decreasesCheckBalance() public {
        _depositToStrategy(10_000e6);

        uint256 balanceBefore = curveAMOStrategy.checkBalance(address(usdc));

        vm.prank(address(ousdVault));
        curveAMOStrategy.withdraw(address(ousdVault), address(usdc), 1_000e6);

        uint256 balanceAfter = curveAMOStrategy.checkBalance(address(usdc));
        assertLt(balanceAfter, balanceBefore, "checkBalance should decrease after withdrawal");
    }

    function test_withdrawAll_returnsAllUsdcToVault() public {
        uint256 vaultBalanceBefore = usdc.balanceOf(address(ousdVault));

        vm.prank(address(ousdVault));
        curveAMOStrategy.withdrawAll();

        uint256 vaultBalanceAfter = usdc.balanceOf(address(ousdVault));
        assertGt(vaultBalanceAfter - vaultBalanceBefore, 0, "Vault should receive USDC from withdrawAll");
        assertApproxEqAbs(
            curveAMOStrategy.checkBalance(address(usdc)), 0, 1e6, "checkBalance should be ~0 after withdrawAll"
        );
    }

    function test_withdrawAndRedeposit_cycle() public {
        vm.prank(address(ousdVault));
        curveAMOStrategy.withdrawAll();

        uint256 balanceAfterWithdraw = curveAMOStrategy.checkBalance(address(usdc));
        assertApproxEqAbs(balanceAfterWithdraw, 0, 1e6, "Should be ~0 after withdrawAll");

        _depositToStrategy(5_000e6);

        uint256 balanceAfterRedeposit = curveAMOStrategy.checkBalance(address(usdc));
        assertGt(balanceAfterRedeposit, 4_000e6, "checkBalance should reflect redeposited funds");
    }
}
