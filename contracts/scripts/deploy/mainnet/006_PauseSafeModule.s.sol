// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";

// Contracts
import {PauseSafeModule} from "contracts/automation/PauseSafeModule.sol";

// Addresses
import {CrossChain} from "tests/utils/Addresses.sol";

/// @title 006_PauseSafeModule
/// @notice Deploys the Safe module that lets a threat-detection operator pause the OUSD and OETH
///         vaults without gathering multisig signatures.
/// @dev No governance proposal: the 2/8 Guardian Safe hosting the module is already the vaults'
///      Strategist, and the Strategist may pause. The module widens no authority — it only removes
///      the signature-gathering step. It cannot unpause, because the only selectors compiled into
///      its bytecode are `pauseCapital()`, `pauseRebase()` and `pause()`.
///
///      Depends on 005_VaultAdminRole having landed: without the Admin role the Strategist could
///      still unpause, and handing an automated operator a pause trigger would be handing it an
///      unpause trigger too.
///
///      REQUIRED POST-DEPLOY STEP — the module does nothing until the Safe calls
///      `enableModule(<module>)` and `isModuleEnabled(<module>)` reads true. This is the step that
///      was silently skipped for PermissionedRebaseModule, leaving it dead on-chain for months.
///
///      The ARMs are deliberately NOT allow-listed here. They only become pausable by this Safe
///      once arm-oeth PR #337 ships and each ARM has had `setPauseRoles(2/8, 5/8)` called; the Safe
///      adds each one afterwards with `allowTarget(<arm>)`. Allow-listing them now would look
///      configured but revert on use.
contract $006_PauseSafeModule is AbstractDeployScript("006_PauseSafeModule") {
    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        address[] memory operators = new address[](1);
        // The Hypernative keeper address is not known yet. Ship with the Talos relayer as the
        // initial operator; the Safe grants OPERATOR_ROLE to the keeper once the vendor supplies
        // its address. Both are pause-only, so neither can undo what it triggers.
        operators[0] = CrossChain.talosRelayer;

        address[] memory targets = new address[](2);
        targets[0] = resolver.resolve("OUSD_VAULT_PROXY");
        targets[1] = resolver.resolve("OETH_VAULT_PROXY");

        PauseSafeModule pauseSafeModule = new PauseSafeModule(CrossChain.multichainStrategist, operators, targets);
        _recordDeployment("PAUSE_SAFE_MODULE", address(pauseSafeModule), type(PauseSafeModule).name);
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        PauseSafeModule pauseSafeModule = PauseSafeModule(payable(resolver.resolve("PAUSE_SAFE_MODULE")));

        require(address(pauseSafeModule.safeContract()) == CrossChain.multichainStrategist, "Wrong Safe");
        require(pauseSafeModule.isPausableTarget(resolver.resolve("OUSD_VAULT_PROXY")), "OUSD vault not allow-listed");
        require(pauseSafeModule.isPausableTarget(resolver.resolve("OETH_VAULT_PROXY")), "OETH vault not allow-listed");
        require(
            pauseSafeModule.hasRole(pauseSafeModule.OPERATOR_ROLE(), CrossChain.talosRelayer), "Operator role not set"
        );

        // Enabling the module is a Safe transaction, not part of any proposal, so it has to be
        // simulated here for the smoke tests to exercise the module at all. Guarded because
        // `_fork()` is re-run by every later smoke suite and Safe reverts on a double enable.
        ISafeModuleManager safe = ISafeModuleManager(CrossChain.multichainStrategist);
        if (!safe.isModuleEnabled(address(pauseSafeModule))) {
            vm.prank(CrossChain.multichainStrategist);
            safe.enableModule(address(pauseSafeModule));
        }
        require(safe.isModuleEnabled(address(pauseSafeModule)), "Module not enabled on the Safe");
    }
}

// ==================== External Interface ==================== //

/// @notice Module management surface on a Gnosis Safe. Not part of ISafe, which only carries the
///         `execTransactionFromModule` call the modules themselves make.
interface ISafeModuleManager {
    function enableModule(address module) external;
    function isModuleEnabled(address module) external view returns (bool);
}
