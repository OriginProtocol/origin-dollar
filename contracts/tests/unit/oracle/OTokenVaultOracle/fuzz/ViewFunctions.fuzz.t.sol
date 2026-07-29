// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Unit_OTokenVaultOracle_Shared_Test } from "../shared/Shared.t.sol";

contract Unit_Fuzz_OTokenVaultOracle_ViewFunctions_Test is
    Unit_OTokenVaultOracle_Shared_Test
{
    /// @notice The oracle always reports total value divided by total supply with 18 decimals.
    function testFuzz_price_reportsAssetValuePerOToken(
        uint256 totalValue,
        uint256 totalSupply
    ) public {
        totalValue = bound(totalValue, 0, 1e40);
        totalSupply = bound(totalSupply, 1, 1e40);

        mockVault.setTotalValue(totalValue);
        mockOToken.setTotalSupply(totalSupply);

        assertEq(oracle.price(), (totalValue * 1e18) / totalSupply);
    }
}
