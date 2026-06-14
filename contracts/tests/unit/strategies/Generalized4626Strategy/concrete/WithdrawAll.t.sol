// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_Generalized4626Strategy_Shared_Test
} from "tests/unit/strategies/Generalized4626Strategy/shared/Shared.t.sol";

contract Unit_Concrete_Generalized4626Strategy_WithdrawAll_Test is Unit_Generalized4626Strategy_Shared_Test {
    function test_withdrawAll_redeemsSharesToVault() public {
        _depositAsVault(100e18);

        vm.prank(address(ousdVault));
        strategy.withdrawAll();

        assertEq(shareVault.balanceOf(address(strategy)), 0);
        // Assets go to vaultAddress
        assertEq(asset.balanceOf(address(ousdVault)), 100e18);
    }

    function test_withdrawAll_noOpWhenZeroShares() public {
        vm.prank(address(ousdVault));
        strategy.withdrawAll();

        assertEq(asset.balanceOf(address(ousdVault)), 0);
    }

    function test_withdrawAll_calledByGovernor() public {
        _depositAsVault(100e18);

        vm.prank(governor);
        strategy.withdrawAll();

        assertEq(shareVault.balanceOf(address(strategy)), 0);
        assertEq(asset.balanceOf(address(ousdVault)), 100e18);
    }

    function test_withdrawAll_RevertWhen_calledByNonVaultOrGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault or Governor");
        strategy.withdrawAll();
    }
}
