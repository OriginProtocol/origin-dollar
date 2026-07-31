// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Foundry
import {Vm} from "forge-std/Vm.sol";

// Helpers
import {State} from "scripts/deploy/helpers/DeploymentTypes.sol";
import {Resolver} from "scripts/deploy/helpers/Resolver.sol";

/// @title Base
/// @notice Base contract providing common infrastructure for all deployment scripts.
/// @dev This abstract contract provides:
///      - Access to Foundry's VM cheat codes
///      - Connection to the Resolver for contract address lookups
///      - Deployment state management (FORK_TEST, FORK_DEPLOYING, REAL_DEPLOYING)
///      - Logging configuration
///      - Chain ID to name mapping for multi-chain support
///
///      Inheritance Chain:
///      Base → AbstractDeployScript → Specific deployment scripts
///      Base → DeployManager
///
///      The Resolver is accessed at a deterministic address computed from the hash
///      of "Resolver". This allows all scripts to share the same Resolver instance
///      without passing addresses around.
abstract contract Base {
    // ==================== Foundry Infrastructure ==================== //

    /// @notice Foundry's VM cheat code contract instance.
    /// @dev Provides access to all vm.* functions (prank, broadcast, roll, warp, etc.)
    ///      Address is computed as the uint256 hash of "hevm cheat code".
    Vm internal vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @notice Central registry for deployed contracts and execution history.
    /// @dev Deployed by DeployManager at a deterministic address using vm.etch.
    ///      Address is computed as the uint256 hash of "Resolver".
    ///      Provides:
    ///      - implementations(name): Get deployed contract address by name
    ///      - executionExists(name): Check if a script has been run
    ///      - addContract(name, addr): Register a deployed contract
    ///      - addExecution(name, timestamp): Mark a script as executed
    Resolver internal resolver = Resolver(address(uint160(uint256(keccak256("Resolver")))));

    // ==================== Logging Configuration ==================== //

    /// @notice Whether logging is enabled for this script.
    /// @dev Controlled by the deployment state:
    ///      - REAL_DEPLOYING: Logging enabled (full visibility)
    ///      - FORK_DEPLOYING: Logging enabled (dry-run visibility)
    ///      - FORK_TEST: Logging disabled (reduce test noise) unless forcedLog is true
    ///      Set in AbstractDeployScript constructor.
    bool public log;

    /// @notice Force logging even in FORK_TEST mode.
    /// @dev Override this to true in a specific script to enable verbose output
    ///      during fork testing. Useful for debugging specific deployments.
    bool public forcedLog = false;

    // ==================== Deployment State ==================== //

    /// @notice Current deployment execution state.
    /// @dev Set by DeployManager via Resolver.setState() before script execution.
    ///      Controls whether to use vm.broadcast (real) or vm.prank (simulated).
    ///      See State enum in DeploymentTypes.sol for full documentation.
    State public state;

    /// @notice The root directory of the Foundry project.
    /// @dev Used for constructing file paths for JSON persistence.
    ///      Retrieved from vm.projectRoot() at contract creation.
    string public projectRoot = vm.projectRoot();

    // ==================== Multi-Chain Support ==================== //

    /// @notice Mapping from chain ID to human-readable chain name.
    /// @dev Used for logging and file path construction (e.g., "mainnet", "sonic").
    ///      Populated in the constructor with supported chains.
    mapping(uint256 chainId => string chainName) public chainNames;

    // ==================== Modifiers ==================== //

    /// @notice Modifier to pause execution tracing during expensive operations.
    /// @dev Wraps the function body with vm.pauseTracing/vm.resumeTracing.
    ///      Useful for reducing trace output during JSON parsing or other
    ///      operations that generate excessive trace noise.
    modifier pauseTracing() {
        vm.pauseTracing();
        _;
        vm.resumeTracing();
    }

    // ==================== Constructor ==================== //

    /// @notice Initializes the chain name mappings.
    /// @dev Add new chains here when expanding multi-chain support.
    ///      The chain names should match the directory names in scripts/deploy/
    ///      (e.g., "mainnet" for chain ID 1, "sonic" for chain ID 146).
    constructor() {
        chainNames[1] = "Ethereum Mainnet";
        chainNames[146] = "Sonic Mainnet";
        chainNames[8453] = "Base Mainnet";
        chainNames[999] = "HyperEVM";
    }
}
