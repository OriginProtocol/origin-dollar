// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_Generalized4626Strategy_Shared_Test
} from "tests/unit/strategies/Generalized4626Strategy/shared/Shared.t.sol";
import {IGeneralized4626Strategy} from "contracts/interfaces/strategies/IGeneralized4626Strategy.sol";

contract Unit_Concrete_Generalized4626Strategy_Withdraw_Test is Unit_Generalized4626Strategy_Shared_Test {
    function test_withdraw_withdrawsFromERC4626Vault() public {
        _depositAsVault(100e18);

        vm.prank(address(ousdVault));
        strategy.withdraw(alice, address(asset), 50e18);

        assertEq(asset.balanceOf(alice), 50e18);
        assertEq(shareVault.balanceOf(address(strategy)), 50e18);
    }

    function test_withdraw_emitsWithdrawal() public {
        _depositAsVault(100e18);

        vm.expectEmit(true, true, true, true);
        emit IGeneralized4626Strategy.Withdrawal(address(asset), address(shareVault), 50e18);

        vm.prank(address(ousdVault));
        strategy.withdraw(alice, address(asset), 50e18);
    }

    function test_withdraw_RevertWhen_amountIsZero() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Must withdraw something");
        strategy.withdraw(alice, address(asset), 0);
    }

    function test_withdraw_RevertWhen_recipientIsZero() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Must specify recipient");
        strategy.withdraw(address(0), address(asset), 50e18);
    }

    function test_withdraw_RevertWhen_wrongAsset() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Unexpected asset address");
        strategy.withdraw(alice, address(0xdead), 50e18);
    }

    function test_withdraw_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        strategy.withdraw(alice, address(asset), 50e18);
    }
}
