// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_VaultValueChecker_Shared_Test} from "tests/unit/strategies/VaultValueChecker/shared/Shared.t.sol";

contract Unit_Concrete_VaultValueChecker_TakeSnapshot_Test is Unit_VaultValueChecker_Shared_Test {
    function test_takeSnapshot_storesValues() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        (uint256 vaultValue, uint256 totalSupply, uint256 time) = ousdChecker.snapshots(alice);
        assertEq(vaultValue, 100e18);
        assertEq(totalSupply, 90e18);
        assertEq(time, block.timestamp);
    }

    function test_takeSnapshot_overwritesPreviousSnapshot() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        vm.warp(block.timestamp + 60);

        _setVaultState(200e18, 180e18);
        vm.prank(alice);
        ousdChecker.takeSnapshot();

        (uint256 vaultValue, uint256 totalSupply, uint256 time) = ousdChecker.snapshots(alice);
        assertEq(vaultValue, 200e18);
        assertEq(totalSupply, 180e18);
        assertEq(time, block.timestamp);
    }

    function test_takeSnapshot_perUserIsolation() public {
        _takeSnapshotAs(alice, 100e18, 90e18);

        _setVaultState(200e18, 180e18);
        vm.prank(bobby);
        ousdChecker.takeSnapshot();

        (uint256 aliceVaultValue,,) = ousdChecker.snapshots(alice);
        (uint256 bobbyVaultValue,,) = ousdChecker.snapshots(bobby);

        assertEq(aliceVaultValue, 100e18);
        assertEq(bobbyVaultValue, 200e18);
    }
}
