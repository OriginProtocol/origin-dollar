// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OTokenVaultLens_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Fuzz_OTokenVaultLens_GetRate_Test is Unit_OTokenVaultLens_Shared_Test {
    /// @notice The lens always reports total value divided by total supply with 18 decimals,
    ///         or reverts when the computed rate would be zero.
    function testFuzz_getRate_reportsAssetValuePerOToken(uint256 totalValue, uint256 totalSupply) public {
        totalValue = bound(totalValue, 0, 1e40);
        totalSupply = bound(totalSupply, 1, 1e40);

        mockVault.setTotalValue(totalValue);
        mockOToken.setTotalSupply(totalSupply);

        uint256 expected = (totalValue * 1e18) / totalSupply;
        if (expected == 0) {
            vm.expectRevert("Invalid rate");
            lens.getRate();
        } else {
            assertEq(lens.getRate(), expected);
        }
    }

    /// @notice getRate reverts if and only if the last verified balance is more than
    ///         MAX_VERIFIED_BALANCE_AGE seconds old, over the full uint64 timestamp range.
    function testFuzz_getRate_stalenessBoundary(uint64 lastVerified, uint256 nowTimestamp) public {
        nowTimestamp = bound(nowTimestamp, 7 days, uint256(type(uint64).max) + 365 days);
        vm.warp(nowTimestamp);
        mockStrategy.setLastVerifiedBalanceTimestamp(lastVerified);

        if (uint256(lastVerified) + lens.MAX_VERIFIED_BALANCE_AGE() < block.timestamp) {
            vm.expectRevert("Stale verified balance");
            lens.getRate();
        } else {
            assertEq(lens.getRate(), 1e18);
        }
    }
}
