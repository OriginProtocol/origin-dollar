// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Addresses (aliased — `Base` also names the deploy-framework base contract)
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

// Contracts
import {OETHBaseVault} from "contracts/vault/OETHBaseVault.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";

/// @title 001_VaultMintGate
/// @notice Upgrade the superOETHb vault implementation to add the under-backed
///         mint gate: `mint` reverts while the vault's total value is below OToken supply.
contract $001_VaultMintGate is AbstractDeployScript("001_VaultMintGate") {
    using GovHelper for GovProposal;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        OETHBaseVault vaultImpl = new OETHBaseVault(BaseAddresses.WETH);
        _recordDeployment("OETHBASE_VAULT_IMPL", address(vaultImpl));
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        govProposal.setDescription("Add the under-backed mint gate to the superOETHb vault");
        govProposal.action(
            resolver.resolve("OETHBASE_VAULT_PROXY"),
            "upgradeTo(address)",
            abi.encode(resolver.resolve("OETHBASE_VAULT_IMPL"))
        );
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        address proxy = resolver.resolve("OETHBASE_VAULT_PROXY");
        address expectedImpl = resolver.resolve("OETHBASE_VAULT_IMPL");
        address currentImpl = InitializeGovernedUpgradeabilityProxy(payable(proxy)).implementation();
        require(currentImpl == expectedImpl, "superOETHb vault proxy implementation not updated");
    }
}
