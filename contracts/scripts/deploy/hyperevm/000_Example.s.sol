// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import { AbstractDeployScript } from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import { GovHelper } from "scripts/deploy/helpers/GovHelper.sol";
import { GovProposal } from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import { CrossChainRemoteStrategy } from "contracts/strategies/crosschain/CrossChainRemoteStrategy.sol";
import { InitializableAbstractStrategy } from "contracts/utils/InitializableAbstractStrategy.sol";
import { AbstractCCTPIntegrator } from "contracts/strategies/crosschain/AbstractCCTPIntegrator.sol";
import { InitializeGovernedUpgradeabilityProxy } from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";

/// @title 000_Example
/// @notice Example deployment script demonstrating a CrossChainRemoteStrategy upgrade on HyperEVM.
/// @dev This script serves as a template for future HyperEVM deployments.
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

    /// @notice Deploys a new CrossChainRemoteStrategy implementation contract.
    /// @dev Records the deployment under "CROSS_CHAIN_REMOTE_STRATEGY_IMPL" so it can be resolved
    ///      by _buildGovernanceProposal() and _fork().
    ///      Replace the placeholder constructor arguments with actual values when activating.
    function _execute() internal override {
        CrossChainRemoteStrategy newImpl = new CrossChainRemoteStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig(
                address(0),
                address(0)
            ),
            AbstractCCTPIntegrator.CCTPIntegrationConfig(
                address(0),
                address(0),
                0,
                address(0),
                address(0),
                address(0)
            )
        );
        _recordDeployment("CROSS_CHAIN_REMOTE_STRATEGY_IMPL", address(newImpl));
    }

    // ==================== Governance Proposal ==================== //

    /// @notice Builds a governance proposal to upgrade the CrossChainRemoteStrategy proxy.
    /// @dev Calls upgradeTo() on the proxy with the newly deployed implementation.
    ///      The proposal is simulated on a fork or output as calldata for real deployments.
    function _buildGovernanceProposal() internal override {
        address proxy = resolver.resolve("CROSS_CHAIN_REMOTE_STRATEGY");
        address newImpl = resolver.resolve("CROSS_CHAIN_REMOTE_STRATEGY_IMPL");

        govProposal.setDescription(
            "Upgrade CrossChainRemoteStrategy implementation on HyperEVM"
        );
        govProposal.action(proxy, "upgradeTo(address)", abi.encode(newImpl));
    }

    // ==================== Fork Verification ==================== //

    /// @notice Verifies the upgrade was applied correctly on a fork.
    /// @dev Checks that the proxy's implementation slot points to the new implementation.
    function _fork() internal override {
        address proxy = resolver.resolve("CROSS_CHAIN_REMOTE_STRATEGY");
        address expectedImpl = resolver.resolve(
            "CROSS_CHAIN_REMOTE_STRATEGY_IMPL"
        );

        // Verify implementation was updated
        address currentImpl = InitializeGovernedUpgradeabilityProxy(
            payable(proxy)
        ).implementation();
        require(
            currentImpl == expectedImpl,
            "CrossChainRemoteStrategy proxy implementation not updated"
        );
    }
}
