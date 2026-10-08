// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_Base_PauseSafeModule_Shared_Test} from "tests/smoke/base/automation/PauseSafeModule/shared/Shared.t.sol";

// --- Test utilities
import {CrossChain} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_Base_PauseSafeModule_Test is Smoke_Base_PauseSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WIRING
    //////////////////////////////////////////////////////

    function test_operatorRole_isTalosRelayer() public view {
        assertTrue(pauseSafeModule.hasRole(pauseSafeModule.OPERATOR_ROLE(), CrossChain.talosRelayer));
    }

    /// @dev The step that was skipped for PermissionedRebaseModule, leaving it dead on-chain for
    ///      months. A module that is not enabled reverts on every call it makes.
    function test_module_isEnabledOnTheGuardianSafe() public view {
        assertTrue(ISafeModuleManager(CrossChain.multichainStrategist).isModuleEnabled(address(pauseSafeModule)));
    }

    function test_vault_isAllowListed() public view {
        assertTrue(pauseSafeModule.isPausableTarget(address(oethBaseVault)));
    }

    /// @dev The module forwards through the Safe, which authorizes as the vault's Strategist. The
    ///      2/8 Guardian Safe has the same address on Base as on mainnet.
    function test_guardianSafe_isTheStrategist() public view {
        assertEq(strategist, CrossChain.multichainStrategist);
    }

    //////////////////////////////////////////////////////
    /// --- PAUSE
    //////////////////////////////////////////////////////

    /// @dev The property this whole project exists for: the operator trips the pause through the
    ///      Guardian Safe, and that same Safe — the vault's Strategist — cannot lift it again.
    function test_pauseCapital_onlyAdminCanLiftIt() public {
        assertFalse(oethBaseVault.capitalPaused());

        vm.prank(CrossChain.talosRelayer);
        pauseSafeModule.pauseCapital(address(oethBaseVault));
        assertTrue(oethBaseVault.capitalPaused());

        vm.prank(strategist);
        vm.expectRevert("Caller is not the Admin or Governor");
        oethBaseVault.unpauseCapital();
        assertTrue(oethBaseVault.capitalPaused());

        vm.prank(admin);
        oethBaseVault.unpauseCapital();
        assertFalse(oethBaseVault.capitalPaused());
    }

    function test_pauseRebase_onlyAdminCanLiftIt() public {
        vm.prank(CrossChain.talosRelayer);
        pauseSafeModule.pauseRebase(address(oethBaseVault));
        assertTrue(oethBaseVault.rebasePaused());

        vm.prank(strategist);
        vm.expectRevert("Caller is not the Admin or Governor");
        oethBaseVault.unpauseRebase();
        assertTrue(oethBaseVault.rebasePaused());

        vm.prank(admin);
        oethBaseVault.unpauseRebase();
        assertFalse(oethBaseVault.rebasePaused());
    }

    //////////////////////////////////////////////////////
    /// --- ACCESS CONTROL
    //////////////////////////////////////////////////////

    function test_pauseCapital_RevertWhen_notOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        pauseSafeModule.pauseCapital(address(oethBaseVault));
    }

    function test_allowTarget_RevertWhen_notSafe() public {
        vm.prank(CrossChain.talosRelayer);
        vm.expectRevert("Caller is not the safe contract");
        pauseSafeModule.allowTarget(alice);
    }
}

/// @notice Module management surface on a Gnosis Safe, not part of ISafe.
interface ISafeModuleManager {
    function isModuleEnabled(address module) external view returns (bool);
}
