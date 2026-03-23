// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_MorphoV2Strategy_Shared_Test} from "tests/unit/strategies/MorphoV2Strategy/shared/Shared.t.sol";

contract Unit_Fuzz_MorphoV2Strategy_WithdrawAll_Test is Unit_MorphoV2Strategy_Shared_Test {
    function testFuzz_withdrawAll_correctAmount(uint128 amount) public {
        amount = uint128(bound(uint256(amount), 1, type(uint128).max));

        _depositAsVault(uint256(amount));

        vm.prank(address(ousdVault));
        strategy.withdrawAll();

        // All assets should be withdrawn to vault
        assertEq(asset.balanceOf(address(ousdVault)), uint256(amount));
        assertEq(shareVault.balanceOf(address(strategy)), 0);
    }

    function testFuzz_withdrawAll_limitedLiquidity(uint128 depositAmount, uint128 liquidityRatio) public {
        depositAmount = uint128(bound(uint256(depositAmount), 1e18, type(uint128).max));
        liquidityRatio = uint128(bound(uint256(liquidityRatio), 1, 100));

        _depositAsVault(uint256(depositAmount));

        // Calculate limited liquidity based on ratio
        uint256 limitedAssets = (uint256(depositAmount) * uint256(liquidityRatio)) / 100;
        if (limitedAssets == 0) limitedAssets = 1;

        // Reduce vault's asset balance to simulate limited liquidity
        deal(address(asset), address(shareVault), limitedAssets);

        // Get the max withdrawable before calling withdrawAll
        uint256 maxW = strategy.maxWithdraw();

        vm.prank(address(ousdVault));
        strategy.withdrawAll();

        // Withdrawn amount should be <= _maxWithdraw
        uint256 vaultBalance = asset.balanceOf(address(ousdVault));
        assertLe(vaultBalance, maxW);
    }
}
