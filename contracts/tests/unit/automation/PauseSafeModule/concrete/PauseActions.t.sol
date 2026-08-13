// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_PauseSafeModule_Shared_Test} from "tests/unit/automation/PauseSafeModule/shared/Shared.t.sol";

// --- Mocks
import {MockPausableARM} from "tests/mocks/MockPausableARM.sol";

contract Unit_Concrete_PauseSafeModule_PauseActions_Test is Unit_PauseSafeModule_Shared_Test {
    event CapitalPauseExecuted(address indexed target);
    event RebasePauseExecuted(address indexed target);
    event PauseExecuted(address indexed target);

    //////////////////////////////////////////////////////
    /// --- PAUSE CAPITAL
    //////////////////////////////////////////////////////

    function test_pauseCapital_operatorTripsTheVaultFlag() public {
        assertFalse(oethVault.capitalPaused());

        vm.expectEmit(address(pauseSafeModule));
        emit CapitalPauseExecuted(address(oethVault));

        vm.prank(operator);
        pauseSafeModule.pauseCapital(address(oethVault));

        assertTrue(oethVault.capitalPaused());
    }

    function test_pauseCapital_revertsForNonOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        pauseSafeModule.pauseCapital(address(oethVault));

        assertFalse(oethVault.capitalPaused());
    }

    function test_pauseCapital_revertsForUnlistedTarget() public {
        vm.prank(operator);
        vm.expectRevert("Target not allowed");
        pauseSafeModule.pauseCapital(address(unlistedVault));

        assertFalse(unlistedVault.capitalPaused());
    }

    function test_pauseCapital_revertsAfterTargetRevoked() public {
        vm.prank(address(mockSafe));
        pauseSafeModule.revokeTarget(address(oethVault));

        vm.prank(operator);
        vm.expectRevert("Target not allowed");
        pauseSafeModule.pauseCapital(address(oethVault));

        assertFalse(oethVault.capitalPaused());
    }

    /// @dev The Safe must be the vault's Strategist for the forwarded call to
    ///      authorize. Strip that role and the vault rejects the Safe, which the
    ///      module surfaces as a hard revert rather than a silent no-op.
    function test_pauseCapital_revertsWhenSafeLosesStrategistRole() public {
        vm.prank(governor);
        oethVault.setStrategistAddr(alice);

        vm.prank(operator);
        vm.expectRevert("Pause failed");
        pauseSafeModule.pauseCapital(address(oethVault));

        assertFalse(oethVault.capitalPaused());
    }

    //////////////////////////////////////////////////////
    /// --- PAUSE REBASE
    //////////////////////////////////////////////////////

    function test_pauseRebase_operatorTripsTheVaultFlag() public {
        assertFalse(oethVault.rebasePaused());

        vm.expectEmit(address(pauseSafeModule));
        emit RebasePauseExecuted(address(oethVault));

        vm.prank(operator);
        pauseSafeModule.pauseRebase(address(oethVault));

        assertTrue(oethVault.rebasePaused());
    }

    function test_pauseRebase_revertsForNonOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        pauseSafeModule.pauseRebase(address(oethVault));

        assertFalse(oethVault.rebasePaused());
    }

    function test_pauseRebase_revertsForUnlistedTarget() public {
        vm.prank(operator);
        vm.expectRevert("Target not allowed");
        pauseSafeModule.pauseRebase(address(unlistedVault));

        assertFalse(unlistedVault.rebasePaused());
    }

    //////////////////////////////////////////////////////
    /// --- PAUSE (ARM-shaped targets)
    //////////////////////////////////////////////////////

    function test_pause_operatorTripsAnArm() public {
        assertFalse(arm.paused());

        vm.expectEmit(address(pauseSafeModule));
        emit PauseExecuted(address(arm));

        vm.prank(operator);
        pauseSafeModule.pause(address(arm));

        assertTrue(arm.paused());
    }

    function test_pause_revertsForNonOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        pauseSafeModule.pause(address(arm));

        assertFalse(arm.paused());
    }

    function test_pause_revertsForUnlistedTarget() public {
        vm.prank(operator);
        vm.expectRevert("Target not allowed");
        pauseSafeModule.pause(address(unlistedVault));
    }

    /// @dev The vault selectors do not exist on an ARM and vice versa. Aiming the
    ///      wrong entry point at a target fails loudly rather than doing something
    ///      unexpected.
    function test_pause_mismatchedSelectorReverts() public {
        vm.prank(operator);
        vm.expectRevert("Pause failed");
        pauseSafeModule.pauseCapital(address(arm));

        vm.prank(operator);
        vm.expectRevert("Pause failed");
        pauseSafeModule.pause(address(oethVault));
    }

    /// @dev Same separation as the vaults, on an ARM: the Safe hosting the module
    ///      is the ARM guardian, so it can pause but the ARM rejects its unpause.
    function test_onlyAdminCanLiftAnArmPause() public {
        vm.prank(operator);
        pauseSafeModule.pause(address(arm));
        assertTrue(arm.paused());

        vm.prank(address(mockSafe));
        vm.expectRevert(MockPausableARM.OnlyUnpauser.selector);
        arm.unpause();
        assertTrue(arm.paused());

        vm.prank(guardian);
        arm.unpause();
        assertFalse(arm.paused());
    }

    //////////////////////////////////////////////////////
    /// --- SEPARATION OF PAUSE AND UNPAUSE
    //////////////////////////////////////////////////////

    /// @dev The core safety property. The module can only ever encode
    ///      `pauseCapital()` and `pauseRebase()`, so there is no call it can make
    ///      that lifts a pause. If someone later adds an unpause entry point these
    ///      calls stop reverting and this test fails.
    function test_module_hasNoUnpauseEntryPoint() public {
        string[4] memory signatures = [
            "unpauseCapital(address)",
            "unpauseRebase(address)",
            "unpauseCapital()",
            "unpauseRebase()"
        ];

        for (uint256 i = 0; i < signatures.length; i++) {
            (bool success,) = address(pauseSafeModule).call(
                abi.encodeWithSelector(bytes4(keccak256(bytes(signatures[i]))), address(oethVault))
            );
            assertFalse(success, signatures[i]);
        }
    }

    /// @dev End to end: the module pauses, and only the Admin can lift it. The
    ///      Safe that hosts the module cannot undo its own pause.
    function test_onlyAdminCanLiftAModulePause() public {
        vm.prank(operator);
        pauseSafeModule.pauseCapital(address(oethVault));
        assertTrue(oethVault.capitalPaused());

        // The Safe hosting the module is the Strategist — it paused, but cannot unpause.
        vm.prank(address(mockSafe));
        vm.expectRevert("Caller is not the Admin or Governor");
        oethVault.unpauseCapital();
        assertTrue(oethVault.capitalPaused());

        // The Admin can.
        vm.prank(guardian);
        oethVault.unpauseCapital();
        assertFalse(oethVault.capitalPaused());
    }
}
