// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title DeploymentTypes
/// @notice Core data structures and enums used throughout the deployment framework.
/// @dev This file defines all the types used by:
///      - DeployManager: Orchestrates deployment execution
///      - Resolver: Stores contracts and execution history
///      - AbstractDeployScript: Base class for deployment scripts
///      - GovHelper: Governance proposal creation and simulation

// ==================== Enums ==================== //

/// @notice Represents the current execution state of the deployment process.
/// @dev Controls behavior throughout the deployment framework:
///      - Determines whether to use vm.broadcast (real) or vm.prank (fork)
///      - Controls logging verbosity
///      - Determines whether to simulate or output governance proposals
enum State {
    /// @notice Initial state before deployment context is set.
    /// @dev Should never be active during actual deployment execution.
    DEFAULT,
    /// @notice Fork testing mode - simulates deployment on a forked network.
    /// @dev Uses vm.prank for transaction simulation.
    ///      Governance proposals are simulated through full lifecycle.
    ///      Logging is disabled by default (unless forcedLog is set).
    FORK_TEST,
    /// @notice Fork deployment mode - final verification before real deployment.
    /// @dev Same behavior as FORK_TEST but indicates deployment readiness.
    ///      Used for dry-run verification before REAL_DEPLOYING.
    FORK_DEPLOYING,
    /// @notice Real deployment mode - executes actual on-chain transactions.
    /// @dev Uses vm.broadcast for real transaction submission.
    ///      Governance proposals are output as calldata for manual submission.
    ///      Full logging is enabled.
    REAL_DEPLOYING
}

// ==================== Constants ==================== //

// Sentinel value indicating no governance is needed for a deployment script.
// Used for both proposalId and tsGovernance fields in Execution records.
uint256 constant NO_GOVERNANCE = 1;

// Default value indicating governance is pending (not yet submitted/executed).
// This is the default uint256 value (0). Named for readability.
uint256 constant GOVERNANCE_PENDING = 0;

// ==================== Resolver Data Structures ==================== //

/// @notice Records a deployment script execution for history tracking.
/// @dev Stored in the Resolver to prevent re-running completed scripts.
///      Persisted to JSON for cross-session continuity.
///      Fields are ordered alphabetically for Foundry JSON parser compatibility.
struct Execution {
    /// @notice The unique name of the deployment script.
    /// @dev Format: "NNN_DescriptiveName" (e.g., "015_UpgradeEthenaARMScript")
    string name;
    /// @notice On-chain governance proposal ID.
    /// @dev 0 = governance pending (not yet submitted), 1 = no governance needed (sentinel).
    uint256 proposalId;
    /// @notice Block timestamp when the deployment script was executed.
    /// @dev Used for ordering, auditing, and deterministic fork replay.
    uint256 tsDeployment;
    /// @notice Block timestamp when the governance proposal was executed on-chain.
    /// @dev 0 = governance not yet executed, 1 = no governance needed (sentinel).
    uint256 tsGovernance;
}

/// @notice Represents a deployed contract's address and identifier.
/// @dev Used for cross-script lookups via Resolver.implementations().
///      Persisted to JSON for deployment history.
struct Contract {
    /// @notice The deployed contract address.
    /// @dev For proxies, this is typically the proxy address.
    ///      For implementations, use a distinct name like "ETHENA_ARM_IMPL".
    address implementation;
    /// @notice The unique identifier for this contract.
    /// @dev Convention: UPPER_SNAKE_CASE (e.g., "LIDO_ARM", "ETHENA_ARM_IMPL")
    string name;
}

/// @notice Tracks a contract's position in the Resolver's contracts array.
/// @dev Enables O(1) lookups and in-place updates for existing contracts.
///      Used by Resolver.inContracts mapping.
struct Position {
    /// @notice Index in the contracts array.
    /// @dev Only valid when exists is true.
    uint256 index;
    /// @notice Whether this contract has been registered.
    /// @dev False indicates the contract name hasn't been seen before.
    bool exists;
}

/// @notice Top-level structure for JSON serialization of deployment data.
/// @dev Used by DeployManager for reading/writing the deployments JSON file.
///      Contains the complete deployment history for a chain.
struct Root {
    /// @notice All deployed contracts on this chain.
    /// @dev Maintains insertion order for consistent JSON output.
    Contract[] contracts;
    /// @notice All deployment scripts that have been executed.
    /// @dev Used to skip already-completed scripts.
    Execution[] executions;
}

// ==================== Governance Data Structures ==================== //

/// @notice Represents a single action within a governance proposal.
/// @dev Encapsulates all data needed to execute one governance call.
///      Multiple GovActions form a complete GovProposal.
struct GovAction {
    /// @notice The contract address to call.
    /// @dev Typically a proxy or protocol contract.
    address target;
    /// @notice ETH value to send with the call (usually 0).
    /// @dev Non-zero for payable functions or ETH transfers.
    uint256 value;
    /// @notice The full function signature (e.g., "upgradeTo(address)").
    /// @dev Used to compute the 4-byte selector.
    ///      Empty string indicates raw calldata is provided.
    string fullsig;
    /// @notice ABI-encoded function parameters (without selector).
    /// @dev Combined with fullsig to create complete calldata.
    bytes data;
}

/// @notice Represents a complete governance proposal with description and actions.
/// @dev Built by deployment scripts via GovHelper.action() and GovHelper.setDescription().
///      Can be simulated (fork mode) or output as calldata (real mode).
struct GovProposal {
    /// @notice Human-readable description of the proposal.
    /// @dev Included in the on-chain proposal for transparency.
    ///      Used in proposal ID calculation.
    string description;
    /// @notice Ordered list of actions to execute.
    /// @dev Executed sequentially when the proposal passes.
    GovAction[] actions;
}
