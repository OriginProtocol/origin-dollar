// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_Generalized4626Strategy_Shared_Test
} from "tests/unit/strategies/Generalized4626Strategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_Generalized4626Strategy_Deposit_Test is Unit_Generalized4626Strategy_Shared_Test {
    function test_deposit_depositsToERC4626Vault() public {
        asset.mint(address(strategy), 100e18);

        vm.prank(address(ousdVault));
        strategy.deposit(address(asset), 100e18);

        // Strategy should have share tokens
        assertEq(shareVault.balanceOf(address(strategy)), 100e18);
        // Asset should be in share vault
        assertEq(asset.balanceOf(address(shareVault)), 100e18);
    }

    function test_deposit_emitsDeposit() public {
        asset.mint(address(strategy), 100e18);

        vm.expectEmit(true, true, true, true);
        emit InitializableAbstractStrategy.Deposit(address(asset), address(shareVault), 100e18);

        vm.prank(address(ousdVault));
        strategy.deposit(address(asset), 100e18);
    }

    function test_deposit_RevertWhen_amountIsZero() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Must deposit something");
        strategy.deposit(address(asset), 0);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Unexpected asset address");
        strategy.deposit(address(0xdead), 100e18);
    }

    function test_deposit_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        strategy.deposit(address(asset), 100e18);
    }
}
