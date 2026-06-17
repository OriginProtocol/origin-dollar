// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHSupernovaAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_OETHSupernovaAMOStrategy_Withdraw_Test is Smoke_OETHSupernovaAMOStrategy_Shared_Test {
    function test_withdraw_sendsWETHToVault() public {
        _depositToStrategy(5 ether);

        uint256 vaultBalanceBefore = wrappedEther.balanceOf(address(oethVault));
        uint256 withdrawAmount = 1 ether;

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(wrappedEther), withdrawAmount);

        uint256 vaultBalanceAfter = wrappedEther.balanceOf(address(oethVault));
        assertApproxEqAbs(
            vaultBalanceAfter - vaultBalanceBefore, withdrawAmount, 1e6, "Vault should receive ~withdrawAmount WETH"
        );
    }

    function test_withdraw_decreasesCheckBalance() public {
        _depositToStrategy(5 ether);

        uint256 balanceBefore = oethSupernovaAMOStrategy.checkBalance(address(wrappedEther));

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(wrappedEther), 1 ether);

        uint256 balanceAfter = oethSupernovaAMOStrategy.checkBalance(address(wrappedEther));
        assertLt(balanceAfter, balanceBefore, "checkBalance should decrease after withdrawal");
    }

    function test_withdrawAll_returnsAllToVault() public {
        _depositToStrategy(5 ether);

        uint256 vaultBalanceBefore = wrappedEther.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        uint256 vaultBalanceAfter = wrappedEther.balanceOf(address(oethVault));
        assertGt(vaultBalanceAfter - vaultBalanceBefore, 0, "Vault should receive WETH from withdrawAll");
        assertApproxEqAbs(
            oethSupernovaAMOStrategy.checkBalance(address(wrappedEther)),
            0,
            0.001 ether,
            "checkBalance should be ~0 after withdrawAll"
        );
    }
}
