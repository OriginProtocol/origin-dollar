// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_SonicSwapXAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_SonicSwapXAMOStrategy_Withdraw_Test is Smoke_SonicSwapXAMOStrategy_Shared_Test {
    function test_withdraw_sendsWSToVault() public {
        _depositToStrategy(5 ether);

        uint256 vaultBalanceBefore = wrappedSonic.balanceOf(address(oSonicVault));
        uint256 withdrawAmount = 1 ether;

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(wrappedSonic), withdrawAmount);

        uint256 vaultBalanceAfter = wrappedSonic.balanceOf(address(oSonicVault));
        assertApproxEqAbs(
            vaultBalanceAfter - vaultBalanceBefore, withdrawAmount, 1e6, "Vault should receive ~withdrawAmount wS"
        );
    }

    function test_withdraw_decreasesCheckBalance() public {
        _depositToStrategy(5 ether);

        uint256 balanceBefore = sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic));

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(wrappedSonic), 1 ether);

        uint256 balanceAfter = sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic));
        assertLt(balanceAfter, balanceBefore, "checkBalance should decrease after withdrawal");
    }

    function test_withdrawAll_returnsAllToVault() public {
        _depositToStrategy(5 ether);

        uint256 vaultBalanceBefore = wrappedSonic.balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        uint256 vaultBalanceAfter = wrappedSonic.balanceOf(address(oSonicVault));
        assertGt(vaultBalanceAfter - vaultBalanceBefore, 0, "Vault should receive wS from withdrawAll");
        assertApproxEqAbs(
            sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic)),
            0,
            0.001 ether,
            "checkBalance should be ~0 after withdrawAll"
        );
    }
}
