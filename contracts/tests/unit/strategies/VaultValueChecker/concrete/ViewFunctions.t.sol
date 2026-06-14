// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_VaultValueChecker_Shared_Test} from "tests/unit/strategies/VaultValueChecker/shared/Shared.t.sol";

contract Unit_Concrete_VaultValueChecker_ViewFunctions_Test is Unit_VaultValueChecker_Shared_Test {
    function test_constructor_setsImmutables() public view {
        assertEq(address(ousdChecker.vault()), address(ousdVault));
        assertEq(address(ousdChecker.ousd()), address(ousd));
    }

    function test_oethVaultValueChecker_constructor() public view {
        assertEq(address(oethChecker.vault()), address(oethVault));
        assertEq(address(oethChecker.ousd()), address(oeth));
    }

    function test_oethVaultValueChecker_checkDelta() public {
        // Take snapshot on oethChecker using real OETH vault
        _takeOethSnapshotAs(alice, 100e18, 90e18);

        // No change — should pass
        vm.prank(alice);
        oethChecker.checkDelta(0, 0, 0, 0);
    }
}
