// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {IVault} from "contracts/interfaces/IVault.sol";
import {OETHBaseVault} from "contracts/vault/OETHBaseVault.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";

// Addresses
import {Base as BaseAddresses, CrossChain} from "tests/utils/Addresses.sol";

/// @title 001_VaultAdminRole
/// @notice Gives the Super OETH vault an Admin role that can unpause, alongside the Governor.
/// @dev Base counterpart of mainnet 005_VaultAdminRole. Before this upgrade the Strategist could
///      both pause and unpause, so a single compromised key could trip a pause and immediately lift
///      it. The new `adminAddr` slot splits the two: `pauseCapital`/`pauseRebase` stay open to the
///      Strategist (the 2/8 Guardian Safe), while `unpauseCapital`/`unpauseRebase` become
///      Admin-or-Governor only.
///
///      Governance on Base runs through the TimelockController, with the 5/8 as its proposer and
///      executor — GovHelper handles that. The timelock operation id is salted with
///      keccak256(description), so the description below must not change between scheduling and
///      executing or the scheduled operation is orphaned.
contract $001_VaultAdminRole is AbstractDeployScript("001_VaultAdminRole") {
    using GovHelper for GovProposal;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        OETHBaseVault oethbVaultImpl = new OETHBaseVault(BaseAddresses.WETH);
        _recordDeployment("OETHBASE_VAULT_IMPL", address(oethbVaultImpl), type(OETHBaseVault).name);
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        address oethbVaultProxy = resolver.resolve("OETHBASE_VAULT_PROXY");

        govProposal.setDescription(
            "Upgrade OETHBaseVault: Admin can pause, only Admin or Governor can unpause\n\n"
            "Adds an Admin role to the Super OETH vault and points it at the 5/8 multisig. Pausing "
            "capital and rebasing stays available to the Strategist, the Admin and the Governor; "
            "unpausing is narrowed to the Admin and the Governor, so the Strategist can no longer "
            "lift a pause it triggered. The vault is upgraded and has its Admin set in this same "
            "proposal, so it is never left with an unset Admin."
        );

        govProposal.action(oethbVaultProxy, "upgradeTo(address)", abi.encode(resolver.resolve("OETHBASE_VAULT_IMPL")));
        govProposal.action(oethbVaultProxy, "setAdminAddr(address)", abi.encode(BaseAddresses.admin));
    }

    // ==================== Fork Verification ==================== //

    /// @dev Read-only. Behaviour of the new role split is covered by the smoke tests under
    ///      tests/smoke/base/vault; this only proves the deploy landed.
    function _fork() internal override {
        address vaultProxy = resolver.resolve("OETHBASE_VAULT_PROXY");
        address expectedImpl = resolver.resolve("OETHBASE_VAULT_IMPL");

        require(
            InitializeGovernedUpgradeabilityProxy(payable(vaultProxy)).implementation() == expectedImpl,
            "Vault implementation not updated"
        );

        IVault vault = IVault(vaultProxy);
        require(vault.adminAddr() == BaseAddresses.admin, "Vault admin not set");

        // `adminAddr` was carved out of the storage gap, immediately after `defaultStrategy` and
        // `operatorAddr`. Those two neighbours are where a layout shift would surface first.
        require(vault.defaultStrategy() != address(0), "Default strategy cleared");
        require(vault.operatorAddr() == CrossChain.talosRelayer, "Operator changed");

        // The pause module in 002 drives this vault through the Strategist Safe, so the pause path
        // is only wired if the Safe still holds that role.
        require(vault.strategistAddr() == CrossChain.multichainStrategist, "Strategist changed");
    }
}
