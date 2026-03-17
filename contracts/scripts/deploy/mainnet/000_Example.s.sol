// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import { AbstractDeployScript } from "scripts/deploy/helpers/AbstractDeployScript.s.sol";

// Contracts
import { OUSD } from "contracts/token/OUSD.sol";
import { InitializeGovernedUpgradeabilityProxy } from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";

/// @title 000_Example
/// @notice Example deployment script demonstrating an OUSD implementation upgrade.
/// @dev This script serves as a template for future mainnet deployments.
///      It illustrates the three-phase lifecycle:
///        1. _execute()                  — deploy new implementation
///        2. _buildGovernanceProposal()  — propose the upgrade via governance
///        3. _fork()                     — verify the proxy was upgraded correctly
///
///      skip() returns true, so this script is never executed by DeployManager.
///      Remove or override skip() to activate it in a real deployment.
contract $000_Example is AbstractDeployScript("000_Example") {
    // ==================== Skip ==================== //

    bool public constant override skip = true; // Skip this example by default

    // ==================== Deployment Logic ==================== //

    /// @notice Deploys a new OUSD implementation contract.
    /// @dev Records the deployment under "OUSD_IMPL" so it can be resolved
    ///      by _buildGovernanceProposal() and _fork().
    function _execute() internal override {
        OUSD newImpl = new OUSD();
        _recordDeployment("OUSD_IMPL", address(newImpl));
    }

    // ==================== Governance Proposal ==================== //

    /// @notice Builds a governance proposal to upgrade the OUSD proxy.
    /// @dev Calls upgradeTo() on the OUSD proxy with the newly deployed implementation.
    ///      The proposal is simulated on a fork or output as calldata for real deployments.
    function _buildGovernanceProposal() internal override {
        address ousdProxy = resolver.resolve("OUSD_PROXY");
        address newImpl = resolver.resolve("OUSD_IMPL");

        govProposal.setDescription("Upgrade OUSD implementation");
        govProposal.action(
            ousdProxy,
            "upgradeTo(address)",
            abi.encode(newImpl)
        );
    }

    // ==================== Fork Verification ==================== //

    /// @notice Verifies the upgrade was applied correctly on a fork.
    /// @dev Checks that:
    ///      - The proxy's implementation slot points to the new implementation.
    ///      - Basic OUSD state (name, symbol, totalSupply) is consistent.
    function _fork() internal override {
        address ousdProxy = resolver.resolve("OUSD_PROXY");
        address expectedImpl = resolver.resolve("OUSD_IMPL");

        // Verify implementation was updated
        address currentImpl = InitializeGovernedUpgradeabilityProxy(ousdProxy)
            .implementation();
        require(
            currentImpl == expectedImpl,
            "OUSD proxy implementation not updated"
        );

        // Verify basic OUSD state via the proxy
        OUSD ousd = OUSD(ousdProxy);
        require(
            keccak256(bytes(ousd.name())) == keccak256(bytes("Origin Dollar")),
            "Unexpected OUSD name"
        );
        require(
            keccak256(bytes(ousd.symbol())) == keccak256(bytes("OUSD")),
            "Unexpected OUSD symbol"
        );
        require(ousd.totalSupply() > 0, "OUSD totalSupply is zero");
    }
}
