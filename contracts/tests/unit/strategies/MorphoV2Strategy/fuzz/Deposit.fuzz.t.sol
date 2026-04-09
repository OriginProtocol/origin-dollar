// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_MorphoV2Strategy_Shared_Test} from "tests/unit/strategies/MorphoV2Strategy/shared/Shared.t.sol";

contract Unit_Fuzz_MorphoV2Strategy_Deposit_Test is Unit_MorphoV2Strategy_Shared_Test {
    function testFuzz_deposit_correctShares(uint128 amount) public {
        amount = uint128(bound(uint256(amount), 1, type(uint128).max));

        asset.mint(address(strategy), uint256(amount));

        vm.prank(address(ousdVault));
        strategy.deposit(address(asset), uint256(amount));

        // MockERC4626Vault does 1:1 on first deposit
        assertEq(shareVault.balanceOf(address(strategy)), uint256(amount));
        assertEq(asset.balanceOf(address(shareVault)), uint256(amount));
    }
}
