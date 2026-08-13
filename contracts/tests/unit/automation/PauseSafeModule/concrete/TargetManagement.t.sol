// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_PauseSafeModule_Shared_Test} from "tests/unit/automation/PauseSafeModule/shared/Shared.t.sol";

contract Unit_Concrete_PauseSafeModule_TargetManagement_Test is Unit_PauseSafeModule_Shared_Test {
    event TargetAllowed(address indexed target);
    event TargetRevoked(address indexed target);

    //////////////////////////////////////////////////////
    /// --- ALLOW TARGET
    //////////////////////////////////////////////////////

    function test_allowTarget_safeCanAllow() public {
        vm.expectEmit(address(pauseSafeModule));
        emit TargetAllowed(address(unlistedVault));

        vm.prank(address(mockSafe));
        pauseSafeModule.allowTarget(address(unlistedVault));

        assertTrue(pauseSafeModule.isPausableTarget(address(unlistedVault)));

        // Newly allowed target is immediately pausable
        vm.prank(operator);
        pauseSafeModule.pauseCapital(address(unlistedVault));
        assertTrue(unlistedVault.capitalPaused());
    }

    function test_allowTarget_revertsForNonSafe() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        pauseSafeModule.allowTarget(address(unlistedVault));

        assertFalse(pauseSafeModule.isPausableTarget(address(unlistedVault)));
    }

    function test_allowTarget_revertsForZeroAddress() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Invalid target");
        pauseSafeModule.allowTarget(address(0));
    }

    function test_allowTarget_revertsWhenAlreadyAllowed() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Target already allowed");
        pauseSafeModule.allowTarget(address(oethVault));
    }

    //////////////////////////////////////////////////////
    /// --- REVOKE TARGET
    //////////////////////////////////////////////////////

    function test_revokeTarget_safeCanRevoke() public {
        vm.expectEmit(address(pauseSafeModule));
        emit TargetRevoked(address(oethVault));

        vm.prank(address(mockSafe));
        pauseSafeModule.revokeTarget(address(oethVault));

        assertFalse(pauseSafeModule.isPausableTarget(address(oethVault)));
    }

    function test_revokeTarget_revertsForNonSafe() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        pauseSafeModule.revokeTarget(address(oethVault));

        assertTrue(pauseSafeModule.isPausableTarget(address(oethVault)));
    }

    function test_revokeTarget_revertsWhenNotAllowed() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Target not allowed");
        pauseSafeModule.revokeTarget(address(unlistedVault));
    }

    function test_revokeTarget_canBeReAllowed() public {
        vm.startPrank(address(mockSafe));
        pauseSafeModule.revokeTarget(address(oethVault));
        pauseSafeModule.allowTarget(address(oethVault));
        vm.stopPrank();

        assertTrue(pauseSafeModule.isPausableTarget(address(oethVault)));
    }
}
