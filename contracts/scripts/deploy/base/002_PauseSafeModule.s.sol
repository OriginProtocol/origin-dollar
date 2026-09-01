// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";

// Contracts
import {PauseSafeModule} from "contracts/automation/PauseSafeModule.sol";

// Addresses
import {CrossChain} from "tests/utils/Addresses.sol";

/// @title 002_PauseSafeModule
/// @notice Deploys the Safe module that lets a threat-detection operator pause the Super OETH vault
///         without gathering multisig signatures.
/// @dev Base counterpart of mainnet 006_PauseSafeModule, hosted on the same 2/8 Guardian Safe (the
///      multichain Strategist has the same address on both chains). No governance proposal: that
///      Safe is already the vault's Strategist, and the Strategist may pause. The module widens no
///      authority and cannot unpause — the only selectors compiled into its bytecode are
///      `pauseCapital()`, `pauseRebase()` and `pause()`.
///
///      Depends on 001_VaultAdminRole having landed: without the Admin role the Strategist could
///      still unpause, and handing an automated operator a pause trigger would be handing it an
///      unpause trigger too.
///
///      REQUIRED POST-DEPLOY STEP — the module does nothing until the Safe calls
///      `enableModule(<module>)` and `isModuleEnabled(<module>)` reads true.
contract $002_PauseSafeModule is AbstractDeployScript("002_PauseSafeModule") {
    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        address[] memory operators = new address[](1);
        // The Hypernative keeper address is not known yet. Ship with the Talos relayer as the
        // initial operator; the Safe grants OPERATOR_ROLE to the keeper once the vendor supplies
        // its address. Both are pause-only, so neither can undo what it triggers.
        operators[0] = CrossChain.talosRelayer;

        address[] memory targets = new address[](1);
        targets[0] = resolver.resolve("OETHBASE_VAULT_PROXY");

        PauseSafeModule pauseSafeModule = new PauseSafeModule(CrossChain.multichainStrategist, operators, targets);
        _recordDeployment("PAUSE_SAFE_MODULE", address(pauseSafeModule), type(PauseSafeModule).name);
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        PauseSafeModule pauseSafeModule = PauseSafeModule(payable(resolver.resolve("PAUSE_SAFE_MODULE")));

        require(address(pauseSafeModule.safeContract()) == CrossChain.multichainStrategist, "Wrong Safe");
        require(
            pauseSafeModule.isPausableTarget(resolver.resolve("OETHBASE_VAULT_PROXY")), "OETHb vault not allow-listed"
        );
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
