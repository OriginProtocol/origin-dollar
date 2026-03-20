// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_BaseCurveAMOStrategy_Deposit_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    /// @notice OToken minted should always be between 1x and 2x the deposited amount
    function testFuzz_deposit_oTokenBounded(uint256 amount, uint256 poolWeth, uint256 poolOeth) public {
        amount = bound(amount, 1e15, 100_000 ether);
        poolWeth = bound(poolWeth, 1 ether, 1_000_000 ether);
        poolOeth = bound(poolOeth, 1 ether, 1_000_000 ether);

        _seedVaultForSolvency(amount * 10 + 1_000_000 ether);
        _setupPoolBalances(poolWeth, poolOeth);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        assertGe(oethMinted, amount, "OToken minted less than 1x");
        assertLe(oethMinted, amount * 2, "OToken minted more than 2x");
    }
}
