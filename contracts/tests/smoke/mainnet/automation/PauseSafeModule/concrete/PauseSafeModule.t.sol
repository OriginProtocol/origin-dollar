// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_PauseSafeModule_Shared_Test} from "tests/smoke/mainnet/automation/PauseSafeModule/shared/Shared.t.sol";

// --- Test utilities
import {CrossChain} from "tests/utils/Addresses.sol";

// --- Project imports
import {IVault} from "contracts/interfaces/IVault.sol";

contract Smoke_Concrete_PauseSafeModule_Test is Smoke_PauseSafeModule_Shared_Test {
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

    function test_bothVaults_areAllowListed() public view {
        assertTrue(pauseSafeModule.isPausableTarget(address(ousdVault)));
        assertTrue(pauseSafeModule.isPausableTarget(address(oethVault)));
    }

    /// @dev The module forwards through the Safe, which authorizes as the vaults' Strategist.
    function test_guardianSafe_isTheStrategist() public view {
        assertEq(strategist, CrossChain.multichainStrategist);
        assertEq(oethVault.strategistAddr(), CrossChain.multichainStrategist);
    }

    //////////////////////////////////////////////////////
    /// --- PAUSE CAPITAL
    //////////////////////////////////////////////////////

    function test_pauseCapital_ousd() public {
        _assertOnlyAdminCanLiftACapitalPause(ousdVault);
    }

    function test_pauseCapital_oeth() public {
        _assertOnlyAdminCanLiftACapitalPause(oethVault);
    }

    //////////////////////////////////////////////////////
    /// --- PAUSE REBASE
    //////////////////////////////////////////////////////

    function test_pauseRebase_ousd() public {
        _assertOnlyAdminCanLiftARebasePause(ousdVault);
    }

    function test_pauseRebase_oeth() public {
        _assertOnlyAdminCanLiftARebasePause(oethVault);
    }

    //////////////////////////////////////////////////////
    /// --- ACCESS CONTROL
    //////////////////////////////////////////////////////

    function test_pauseCapital_RevertWhen_notOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        pauseSafeModule.pauseCapital(address(ousdVault));
    }

    function test_pauseRebase_RevertWhen_notOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        pauseSafeModule.pauseRebase(address(oethVault));
    }

    function test_allowTarget_RevertWhen_notSafe() public {
        vm.prank(CrossChain.talosRelayer);
        vm.expectRevert("Caller is not the safe contract");
        pauseSafeModule.allowTarget(alice);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev The property this whole project exists for: the operator trips the pause through the
    ///      Guardian Safe, and that same Safe — the vault's Strategist — cannot lift it again.
    function _assertOnlyAdminCanLiftACapitalPause(IVault vault) internal {
        assertFalse(vault.capitalPaused());

        vm.prank(CrossChain.talosRelayer);
        pauseSafeModule.pauseCapital(address(vault));
        assertTrue(vault.capitalPaused());

        vm.prank(strategist);
        vm.expectRevert("Caller is not the Admin or Governor");
        vault.unpauseCapital();
        assertTrue(vault.capitalPaused());

        vm.prank(admin);
        vault.unpauseCapital();
        assertFalse(vault.capitalPaused());
    }

    function _assertOnlyAdminCanLiftARebasePause(IVault vault) internal {
        vm.prank(CrossChain.talosRelayer);
        pauseSafeModule.pauseRebase(address(vault));
        assertTrue(vault.rebasePaused());

        vm.prank(strategist);
        vm.expectRevert("Caller is not the Admin or Governor");
        vault.unpauseRebase();
        assertTrue(vault.rebasePaused());

        vm.prank(admin);
        vault.unpauseRebase();
        assertFalse(vault.rebasePaused());
    }
}

/// @notice Module management surface on a Gnosis Safe, not part of ISafe.
interface ISafeModuleManager {
    function isModuleEnabled(address module) external view returns (bool);
}
