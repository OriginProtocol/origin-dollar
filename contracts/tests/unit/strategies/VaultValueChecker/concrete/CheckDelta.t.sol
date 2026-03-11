// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_VaultValueChecker_Shared_Test} from "tests/unit/strategies/VaultValueChecker/shared/Shared.t.sol";

contract Unit_Concrete_VaultValueChecker_CheckDelta_Test is Unit_VaultValueChecker_Shared_Test {
    // --- passes ---

    function test_checkDelta_passesWithExactValues() public {
        // Snapshot: vault=100e18, supply=90e18
        _takeSnapshotAs(alice, 100e18, 90e18);

        // Current: vault=110e18, supply=95e18
        // vaultChange = 10e18, supplyChange = 5e18, profit = 5e18
        _setVaultState(110e18, 95e18);

        vm.prank(alice);
        ousdChecker.checkDelta(5e18, 0, 10e18, 0);
    }

    function test_checkDelta_passesWithinVariance() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        // vaultChange = 10e18, supplyChange = 5e18, profit = 5e18
        _setVaultState(110e18, 95e18);

        vm.prank(alice);
        ousdChecker.checkDelta(4e18, 2e18, 9e18, 2e18);
    }

    function test_checkDelta_withNegativeValues() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        // Current: vault=95e18, supply=92e18
        // vaultChange = -5e18, supplyChange = 2e18, profit = -7e18
        _setVaultState(95e18, 92e18);

        vm.prank(alice);
        ousdChecker.checkDelta(-7e18, 0, -5e18, 0);
    }

    function test_checkDelta_passesAtExactExpiry() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        // Warp exactly 300 seconds (SNAPSHOT_EXPIRES)
        vm.warp(block.timestamp + 300);

        vm.prank(alice);
        ousdChecker.checkDelta(0, 0, 0, 0);
    }

    // --- reverts ---

    function test_checkDelta_RevertWhen_noSnapshot() public {
        // No snapshot taken, snapshot.time = 0
        // 0 >= block.timestamp - 300 will fail since block.timestamp is 1000
        vm.prank(alice);
        vm.expectRevert("Snapshot too old");
        ousdChecker.checkDelta(0, 0, 0, 0);
    }

    function test_checkDelta_RevertWhen_snapshotTooOld() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        vm.warp(block.timestamp + 301);

        vm.prank(alice);
        vm.expectRevert("Snapshot too old");
        ousdChecker.checkDelta(0, 0, 0, 0);
    }

    function test_checkDelta_RevertWhen_snapshotTooNew() public {
        // Take snapshot at current timestamp (1000)
        _takeSnapshotAs(alice, 100e18, 90e18);

        // Warp backward
        vm.warp(block.timestamp - 1);

        vm.prank(alice);
        vm.expectRevert("Snapshot too new");
        ousdChecker.checkDelta(0, 0, 0, 0);
    }

    function test_checkDelta_RevertWhen_profitTooLow() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        // vaultChange = 10e18, supplyChange = 5e18, profit = 5e18
        _setVaultState(110e18, 95e18);

        vm.prank(alice);
        vm.expectRevert("Profit too low");
        // expectedProfit=10e18, variance=0 → requires profit >= 10e18 but profit is 5e18
        ousdChecker.checkDelta(10e18, 0, 10e18, 0);
    }

    function test_checkDelta_RevertWhen_profitTooHigh() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        // vaultChange = 10e18, supplyChange = 5e18, profit = 5e18
        _setVaultState(110e18, 95e18);

        vm.prank(alice);
        vm.expectRevert("Profit too high");
        // expectedProfit=1e18, variance=0 → requires profit <= 1e18 but profit is 5e18
        ousdChecker.checkDelta(1e18, 0, 10e18, 0);
    }

    function test_checkDelta_RevertWhen_vaultChangeTooLow() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        // vaultChange = 10e18, supplyChange = 5e18, profit = 5e18
        _setVaultState(110e18, 95e18);

        vm.prank(alice);
        vm.expectRevert("Vault value change too low");
        // expectedVaultChange=20e18, variance=0 → requires vaultChange >= 20e18 but it's 10e18
        ousdChecker.checkDelta(5e18, 0, 20e18, 0);
    }

    function test_checkDelta_RevertWhen_vaultChangeTooHigh() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        // vaultChange = 10e18, supplyChange = 5e18, profit = 5e18
        _setVaultState(110e18, 95e18);

        vm.prank(alice);
        vm.expectRevert("Vault value change too high");
        // expectedVaultChange=1e18, variance=0 → requires vaultChange <= 1e18 but it's 10e18
        ousdChecker.checkDelta(5e18, 0, 1e18, 0);
    }

    function test_checkDelta_RevertWhen_toInt256Overflow() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        // Set vault value to something that overflows int256
        // Use deal to set an impossibly large USDC balance
        uint256 overflowValue = uint256(type(int256).max) + 1;
        // overflowValue / 1e12 would be the USDC amount needed
        deal(address(usdc), address(ousdVault), overflowValue / 1e12 + 1);

        vm.prank(alice);
        vm.expectRevert("SafeCast: value doesn't fit in an int256");
        ousdChecker.checkDelta(0, 0, 0, 0);
    }
}
