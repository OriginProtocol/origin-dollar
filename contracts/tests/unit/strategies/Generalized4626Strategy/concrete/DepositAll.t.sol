// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_Generalized4626Strategy_Shared_Test
} from "tests/unit/strategies/Generalized4626Strategy/shared/Shared.t.sol";

contract Unit_Concrete_Generalized4626Strategy_DepositAll_Test is Unit_Generalized4626Strategy_Shared_Test {
    function test_depositAll_depositsEntireBalance() public {
        asset.mint(address(strategy), 100e18);

        vm.prank(address(ousdVault));
        strategy.depositAll();

        assertEq(shareVault.balanceOf(address(strategy)), 100e18);
        assertEq(asset.balanceOf(address(strategy)), 0);
    }

    function test_depositAll_noOpWhenZeroBalance() public {
        vm.prank(address(ousdVault));
        strategy.depositAll();

        assertEq(shareVault.balanceOf(address(strategy)), 0);
    }

    function test_depositAll_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        strategy.depositAll();
    }
}
