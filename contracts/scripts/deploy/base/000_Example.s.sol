// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import { AbstractDeployScript } from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import { GovHelper } from "scripts/deploy/helpers/GovHelper.sol";
import { GovProposal } from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import { OETHBase } from "contracts/token/OETHBase.sol";
import { InitializeGovernedUpgradeabilityProxy } from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";

/// @title 000_Example
/// @notice Example deployment script demonstrating an OETHBase implementation upgrade.
/// @dev This script serves as a template for future Base deployments.
///      It illustrates the three-phase lifecycle:
///        1. _execute()                  — deploy new implementation
///        2. _buildGovernanceProposal()  — propose the upgrade via governance
///        3. _fork()                     — verify the proxy was upgraded correctly
///
///      skip() returns true, so this script is never executed by DeployManager.
///      Remove or override skip() to activate it in a real deployment.
contract $000_Example is AbstractDeployScript("000_Example") {
    using GovHelper for GovProposal;

    // ==================== Skip ==================== //

    bool public constant override skip = true; // Skip this example by default

    // ==================== Deployment Logic ==================== //

    /// @notice Deploys a new OETHBase implementation contract.
    /// @dev Records the deployment under "OETHB_IMPL" so it can be resolved
    ///      by _buildGovernanceProposal() and _fork().
    function _execute() internal override {
        OETHBase newImpl = new OETHBase();
        _recordDeployment("OETHB_IMPL", address(newImpl));
    }

    // ==================== Governance Proposal ==================== //

    /// @notice Builds a governance proposal to upgrade the OETHBase proxy.
    /// @dev Calls upgradeTo() on the OETHBase proxy with the newly deployed implementation.
    ///      The proposal is simulated on a fork or output as calldata for real deployments.
    function _buildGovernanceProposal() internal override {
        address oethbProxy = resolver.resolve("OETHB_PROXY");
        address newImpl = resolver.resolve("OETHB_IMPL");

        govProposal.setDescription("Upgrade OETHBase implementation");
        govProposal.action(
            oethbProxy,
            "upgradeTo(address)",
            abi.encode(newImpl)
        );
    }

    // ==================== Fork Verification ==================== //

    /// @notice Verifies the upgrade was applied correctly on a fork.
    /// @dev Checks that:
    ///      - The proxy's implementation slot points to the new implementation.
    ///      - Basic OETHBase state (name, symbol, totalSupply) is consistent.
    function _fork() internal override {
        address oethbProxy = resolver.resolve("OETHB_PROXY");
        address expectedImpl = resolver.resolve("OETHB_IMPL");

        // Verify implementation was updated
        address currentImpl = InitializeGovernedUpgradeabilityProxy(payable(oethbProxy))
            .implementation();
        require(
            currentImpl == expectedImpl,
            "OETHBase proxy implementation not updated"
        );

        // Verify basic OETHBase state via the proxy
        OETHBase oethb = OETHBase(oethbProxy);
        require(
            keccak256(bytes(oethb.name())) == keccak256(bytes("OETH")),
            "Unexpected OETHBase name"
        );
        require(
            keccak256(bytes(oethb.symbol())) == keccak256(bytes("OETH")),
            "Unexpected OETHBase symbol"
        );
        require(oethb.totalSupply() > 0, "OETHBase totalSupply is zero");
    }
}
