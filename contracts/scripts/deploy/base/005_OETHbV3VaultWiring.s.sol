// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {IVault} from "contracts/interfaces/IVault.sol";

// Addresses
import {Base} from "tests/utils/Addresses.sol";

/// @title 005_OETHbV3VaultWiring
/// @notice Approves the OETHb V3 Master strategy on the Base vault.
/// @dev Deliberately separate from the deployment of Master itself: approval is what lets the
///      vault route collateral to it, so it waits until the strategy is fully wired to its
///      adapters and governed by the timelock. Nothing is deployed here.
contract $005_OETHbV3VaultWiring is AbstractDeployScript("005_OETHbV3VaultWiring") {
    using GovHelper for GovProposal;

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        govProposal.setDescription(
            "Approve the OETHb V3 Master strategy on the Base vault\n\n"
            "Registers MasterWOTokenStrategy so the vault can allocate WETH to it. Approval only; "
            "no funds move as part of this proposal."
        );

        govProposal.action(
            Base.OETHBaseVaultProxy, "approveStrategy(address)", abi.encode(resolver.resolve("OETHB_V3_MASTER_PROXY"))
        );
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        require(
            IVault(Base.OETHBaseVaultProxy).strategies(resolver.resolve("OETHB_V3_MASTER_PROXY")).isSupported,
            "Master strategy not approved on the vault"
        );
    }
}
