// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_CurveAMOStrategy_Deposit_Test is Unit_CurveAMOStrategy_Shared_Test {
    /// @notice OToken minted should always be between 1x and 2x the deposited amount
    function testFuzz_deposit_oTokenBounded(uint256 amount, uint256 poolHardAsset, uint256 poolOToken) public {
        amount = bound(amount, 1e15, 100_000 ether);
        poolHardAsset = bound(poolHardAsset, 1 ether, 1_000_000 ether);
        poolOToken = bound(poolOToken, 1 ether, 1_000_000 ether);

        _seedVaultForSolvency(amount * 10 + 1_000_000 ether);
        _setupPoolBalances(poolHardAsset, poolOToken);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // OToken minted should be between 1x and 2x the deposit amount
        assertGe(oethMinted, amount, "OToken minted less than 1x");
        assertLe(oethMinted, amount * 2, "OToken minted more than 2x");
    }
}
