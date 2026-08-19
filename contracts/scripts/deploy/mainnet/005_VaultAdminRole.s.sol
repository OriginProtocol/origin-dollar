// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {IVault} from "contracts/interfaces/IVault.sol";
import {OUSDVault} from "contracts/vault/OUSDVault.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";

// Addresses
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

/// @title 005_VaultAdminRole
/// @notice Gives the OUSD and OETH vaults an Admin role that holds the sole right to unpause.
/// @dev Before this upgrade the Strategist could both pause and unpause, so a single compromised
///      key could trip a pause and immediately lift it. The new `adminAddr` slot splits the two:
///      `pauseCapital`/`pauseRebase` stay open to the Strategist (the 2/8 Guardian Safe), while
///      `unpauseCapital`/`unpauseRebase` become Admin-or-Governor only. That is what makes it safe
///      to hand a pause trigger to an automated threat-detection service — see 006_PauseSafeModule.
///
///      `adminAddr` is set in the same proposal as the upgrade so the vaults are never left with a
///      zero Admin, which would leave the Governor as the only account able to lift a pause.
contract $005_VaultAdminRole is AbstractDeployScript("005_VaultAdminRole") {
    using GovHelper for GovProposal;

    /// @notice The Admin (5/8) multisig. Carried in the address books as `Guardian`, a name that
    ///         predates the pause/unpause split — it is the 5/8, not the 2/8 Guardian Safe.
    address internal constant ADMIN = Mainnet.Guardian;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        OUSDVault ousdVaultImpl = new OUSDVault(Mainnet.USDC);
        _recordDeployment("OUSD_VAULT_IMPL", address(ousdVaultImpl), type(OUSDVault).name);

        OETHVault oethVaultImpl = new OETHVault(Mainnet.WETH);
        _recordDeployment("OETH_VAULT_IMPL", address(oethVaultImpl), type(OETHVault).name);
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        address ousdVaultProxy = resolver.resolve("OUSD_VAULT_PROXY");
        address oethVaultProxy = resolver.resolve("OETH_VAULT_PROXY");

        govProposal.setDescription(
            "Upgrade OUSD and OETH vaults: Admin can pause, only Admin can unpause\n\n"
            "Adds an Admin role to both vaults and points it at the 5/8 multisig. Pausing capital "
            "and rebasing stays available to the Strategist, the Admin and the Governor; unpausing "
            "is narrowed to the Admin and the Governor, so the Strategist can no longer lift a "
            "pause it triggered. Each vault is upgraded and has its Admin set in this same "
            "proposal, so neither is left with an unset Admin."
        );

        govProposal.action(ousdVaultProxy, "upgradeTo(address)", abi.encode(resolver.resolve("OUSD_VAULT_IMPL")));
        govProposal.action(ousdVaultProxy, "setAdminAddr(address)", abi.encode(ADMIN));

        govProposal.action(oethVaultProxy, "upgradeTo(address)", abi.encode(resolver.resolve("OETH_VAULT_IMPL")));
        govProposal.action(oethVaultProxy, "setAdminAddr(address)", abi.encode(ADMIN));
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        _verifyVault("OUSD_VAULT_PROXY", "OUSD_VAULT_IMPL");
        _verifyVault("OETH_VAULT_PROXY", "OETH_VAULT_IMPL");
    }

    /// @dev Read-only. Behaviour of the new role split is covered by the smoke tests under
    ///      tests/smoke/mainnet/vault; this only proves the deploy landed.
    function _verifyVault(string memory proxyName, string memory implName) internal view {
        address vaultProxy = resolver.resolve(proxyName);
        address expectedImpl = resolver.resolve(implName);

        require(
            InitializeGovernedUpgradeabilityProxy(payable(vaultProxy)).implementation() == expectedImpl,
            "Vault implementation not updated"
        );

        IVault vault = IVault(vaultProxy);
        require(vault.adminAddr() == ADMIN, "Vault admin not set");

        // `adminAddr` was carved out of the storage gap, immediately after `defaultStrategy` and
        // `operatorAddr`. Those two neighbours are where a layout shift would surface first.
        require(vault.defaultStrategy() != address(0), "Default strategy cleared");
        require(vault.operatorAddr() == CrossChain.talosRelayer, "Operator changed");

        // The pause module in 006 drives these vaults through the Strategist Safe, so the pause
        // path is only wired if the Safe still holds that role.
        require(vault.strategistAddr() == CrossChain.multichainStrategist, "Strategist changed");
    }
}
