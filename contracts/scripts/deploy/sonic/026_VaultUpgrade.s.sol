// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {OSVault} from "contracts/vault/OSVault.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {Sonic} from "tests/utils/Addresses.sol";

/// @title 026_VaultUpgrade
/// @notice Upgrades the OSonic Vault to a new implementation and sets a default strategy.
/// @dev Sonic uses a Timelock Controller for governance, not the mainnet Governor.
///      Governance actions are simulated in _fork() by pranking the timelock address.
///      _buildGovernanceProposal() is intentionally left empty.
contract $026_VaultUpgrade is AbstractDeployScript("026_VaultUpgrade") {
    // ==================== Deployment Logic ==================== //

    /// @notice Deploys a new OSVault implementation contract.
    function _execute() internal override {
        OSVault newImpl = new OSVault(Sonic.wS);
        _recordDeployment("OSONIC_VAULT_IMPL", address(newImpl));
    }

    // ==================== Governance Proposal ==================== //

    /// @notice Intentionally empty — Sonic uses a Timelock Controller, not the mainnet Governor.
    /// @dev Governance actions are applied directly in _fork() via vm.prank(Sonic.timelock).
    function _buildGovernanceProposal() internal override {}

    // ==================== Fork Verification ==================== //

    /// @notice Simulates and verifies the vault upgrade on a Sonic fork.
    /// @dev Pranks the Sonic Timelock to execute the upgrade and set the default strategy,
    ///      then asserts the proxy implementation was updated correctly.
    function _fork() internal override {
        address vaultProxy = resolver.resolve("OSONIC_VAULT_PROXY");
        address newImpl = resolver.resolve("OSONIC_VAULT_IMPL");

        // Simulate governance: prank as timelock to execute upgrade actions
        vm.startPrank(Sonic.timelock);

        // 1. Upgrade vault proxy to new implementation
        InitializeGovernedUpgradeabilityProxy(payable(vaultProxy)).upgradeTo(newImpl);

        // 2. Set Sonic Staking Strategy as default strategy
        IVault(vaultProxy).setDefaultStrategy(Sonic.SonicStakingStrategy);

        vm.stopPrank();

        // Verify implementation was updated
        address currentImpl = InitializeGovernedUpgradeabilityProxy(payable(vaultProxy)).implementation();
        require(currentImpl == newImpl, "Vault implementation not updated");
    }
}
