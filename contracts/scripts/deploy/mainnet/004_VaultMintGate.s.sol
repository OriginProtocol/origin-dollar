// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Addresses
import {Mainnet} from "tests/utils/Addresses.sol";

// Contracts
import {OUSDVault} from "contracts/vault/OUSDVault.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";

/// @title 004_VaultMintGate
/// @notice Upgrade the OUSD and OETH vault implementations to add the under-backed
///         mint gate: `mint` reverts while the vault's total value is below OToken supply.
contract $004_VaultMintGate is AbstractDeployScript("004_VaultMintGate") {
    using GovHelper for GovProposal;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        OUSDVault ousdVaultImpl = new OUSDVault(Mainnet.USDC);
        _recordDeployment("OUSD_VAULT_IMPL", address(ousdVaultImpl));

        OETHVault oethVaultImpl = new OETHVault(Mainnet.WETH);
        _recordDeployment("OETH_VAULT_IMPL", address(oethVaultImpl));
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        govProposal.setDescription("Add the under-backed mint gate to the OUSD and OETH vaults");
        govProposal.action(
            resolver.resolve("OUSD_VAULT_PROXY"), "upgradeTo(address)", abi.encode(resolver.resolve("OUSD_VAULT_IMPL"))
        );
        govProposal.action(
            resolver.resolve("OETH_VAULT_PROXY"), "upgradeTo(address)", abi.encode(resolver.resolve("OETH_VAULT_IMPL"))
        );
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        _assertUpgraded("OUSD_VAULT_PROXY", "OUSD_VAULT_IMPL");
        _assertUpgraded("OETH_VAULT_PROXY", "OETH_VAULT_IMPL");
    }

    function _assertUpgraded(string memory proxyName, string memory implName) internal view {
        address proxy = resolver.resolve(proxyName);
        address expectedImpl = resolver.resolve(implName);
        address currentImpl = InitializeGovernedUpgradeabilityProxy(payable(proxy)).implementation();
        require(currentImpl == expectedImpl, "Vault proxy implementation not updated");
    }
}
