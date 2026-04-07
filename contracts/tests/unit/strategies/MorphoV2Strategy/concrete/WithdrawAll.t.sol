// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_MorphoV2Strategy_Shared_Test} from "tests/unit/strategies/MorphoV2Strategy/shared/Shared.t.sol";
import {IMorphoV2Strategy} from "contracts/interfaces/strategies/IMorphoV2Strategy.sol";

contract Unit_Concrete_MorphoV2Strategy_WithdrawAll_Test is Unit_MorphoV2Strategy_Shared_Test {
    function test_withdrawAll_withdrawsToVault() public {
        _depositAsVault(100e18);

        vm.prank(address(ousdVault));
        strategy.withdrawAll();

        // All assets should go to vaultAddress (ousdVault)
        assertEq(asset.balanceOf(address(ousdVault)), 100e18);
        // Strategy should have no shares left
        assertEq(shareVault.balanceOf(address(strategy)), 0);
    }

    function test_withdrawAll_emitsWithdrawal() public {
        _depositAsVault(100e18);

        vm.expectEmit(true, true, true, true);
        emit IMorphoV2Strategy.Withdrawal(address(asset), address(shareVault), 100e18);

        vm.prank(address(ousdVault));
        strategy.withdrawAll();
    }

    function test_withdrawAll_withLimitedLiquidity() public {
        _depositAsVault(100e18);

        // Reduce vault's asset balance to simulate limited liquidity
        deal(address(asset), address(shareVault), 40e18);

        vm.prank(address(ousdVault));
        strategy.withdrawAll();

        // _maxWithdraw() = asset.balanceOf(shareVault) + underlyingV1Vault.maxWithdraw(adapter) = 40e18 + 0 = 40e18
        // checkBalance() = previewRedeem(balanceOf(strategy)) = previewRedeem(100e18)
        //                 = 100e18 * 40e18 / 100e18 = 40e18
        // min(40e18, 40e18) = 40e18
        assertEq(asset.balanceOf(address(ousdVault)), 40e18);
    }

    function test_withdrawAll_noOpWhenZeroBalance() public {
        // No deposits, call withdrawAll, verify no revert
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
