// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_VaultValueChecker_Shared_Test} from "tests/unit/strategies/VaultValueChecker/shared/Shared.t.sol";

contract Unit_Fuzz_VaultValueChecker_CheckDelta_Test is Unit_VaultValueChecker_Shared_Test {
    function testFuzz_checkDelta_passesWithinVariance(
        uint64 snapshotVault,
        uint64 snapshotSupply,
        uint64 currentVault,
        uint64 currentSupply,
        uint128 profitVariance,
        uint128 vaultChangeVariance
    ) public {
        // Use uint64 to keep values manageable for real contracts
        // Vault values are in 18 decimals, scaled from 6-decimal USDC via *1e12
        // Must be multiples of 1e12 for clean vault values
        uint256 snapshotV = uint256(snapshotVault) * 1e12;
        uint256 snapshotS = uint256(snapshotSupply) * 1e12;
        uint256 currentV = uint256(currentVault) * 1e12;
        uint256 currentS = uint256(currentSupply) * 1e12;

        // Need non-zero supply for changeSupply to work
        vm.assume(snapshotS > 0);
        vm.assume(currentS > 0);

        _takeSnapshotAs(alice, snapshotV, snapshotS);

        _setVaultState(currentV, currentS);

        int256 vaultChange = int256(currentV) - int256(snapshotV);
        int256 supplyChange = int256(currentS) - int256(snapshotS);
        int256 profit = vaultChange - supplyChange;

        vm.prank(alice);
        ousdChecker.checkDelta(
            profit, int256(uint256(profitVariance)), vaultChange, int256(uint256(vaultChangeVariance))
        );
    }
}
