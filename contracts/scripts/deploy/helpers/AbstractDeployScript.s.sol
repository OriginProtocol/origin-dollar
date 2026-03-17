// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Helpers
import { Logger } from "scripts/deploy/helpers/Logger.sol";
import { Resolver } from "scripts/deploy/helpers/Resolver.sol";
import { GovHelper } from "scripts/deploy/helpers/GovHelper.sol";
import { State, Contract, GovProposal, NO_GOVERNANCE, GOVERNANCE_PENDING } from "scripts/deploy/helpers/DeploymentTypes.sol";

// Script Base
import { Base } from "scripts/deploy/Base.s.sol";

/// @title AbstractDeployScript
/// @notice Base abstract contract for orchestrating smart contract deployments.
/// @dev This contract standardizes the deployment workflow by providing:
///      - Consistent execution lifecycle across all deployment scripts
///      - Automatic contract address persistence to the Resolver
///      - Governance proposal building and simulation
///      - Fork testing support with vm.prank instead of vm.broadcast
///
///      Inheritance Pattern:
///      Each deployment script inherits from this contract and implements:
///      - _execute(): The main deployment logic (optional)
///      - _buildGovernanceProposal(): Define governance actions (optional)
///      - _fork(): Post-deployment fork testing logic (optional)
///      - skip(): Return true to skip this script (optional)
///
///      Execution Flow (run()):
///      1. Get state from Resolver
///      2. Load deployer address from environment
///      3. Start broadcast/prank based on state
///      4. Execute _execute() - child contract's deployment logic
///      5. Stop broadcast/prank
///      6. Store deployed contracts in Resolver
///      7. Build and handle governance proposal
///      8. Run _fork() for additional fork testing
abstract contract AbstractDeployScript is Base {
    using Logger for bool;
    using GovHelper for bool;
    using GovHelper for GovProposal;

    // ==================== State Variables ==================== //

    /// @notice Unique identifier for this deployment script.
    /// @dev Used for tracking execution history in the Resolver.
    ///      Format convention: "NNN_DescriptiveName" (e.g., "015_UpgradeEthenaARMScript")
    string public name;

    /// @notice Address that will deploy the contracts.
    /// @dev Loaded from DEPLOYER_ADDRESS environment variable.
    ///      Used with vm.broadcast (real) or vm.prank (fork).
    address public deployer;

    /// @notice Temporary storage for contracts deployed during this script's execution.
    /// @dev Populated by _recordDeployment(), persisted to Resolver in _storeDeployedContract().
    Contract[] public contracts;

    /// @notice Governance proposal to be executed after deployment.
    /// @dev Populated by _buildGovernanceProposal() if the script requires governance actions.
    ///      Contains target addresses, function signatures, and encoded parameters.
    GovProposal public govProposal;

    // ==================== Constructor ==================== //

    /// @notice Initializes the deployment script with its unique name.
    /// @dev Sets up logging based on deployment state.
    /// @param _name Unique identifier for this script (e.g., "015_UpgradeEthenaARMScript")
    constructor(string memory _name) {
        name = _name;
    }

    // ==================== Main Entry Point ==================== //

    /// @notice Main entry point for the deployment process.
    /// @dev Executes the complete deployment lifecycle in 8 steps.
    ///      This function is called by DeployManager._runDeployFile() after
    ///      the script contract is deployed via vm.deployCode().
    ///
    ///      State-dependent behavior:
    ///      - REAL_DEPLOYING: Uses vm.broadcast for actual on-chain transactions
    ///      - FORK_TEST/FORK_DEPLOYING: Uses vm.prank for simulated execution
    function run() external virtual {
        // ===== Step 1: Get Execution State =====
        // Retrieve the current state from the Resolver (set by DeployManager)
        state = resolver.getState();
        // Enable logging unless we're in fork test mode (reduces noise during tests)
        log = state != State.FORK_TEST || forcedLog;

        // ===== Step 2: Load Deployer Address =====
        // The deployer address must be set in the .env file
        if (!vm.envExists("DEPLOYER_ADDRESS")) {
            require(
                state != State.REAL_DEPLOYING,
                "DEPLOYER_ADDRESS not set in .env"
            );
            log.warn(
                "DEPLOYER_ADDRESS not set in .env, using address(0) for fork simulation"
            );
            deployer = address(0x1);
        } else {
            deployer = vm.envAddress("DEPLOYER_ADDRESS");
        }

        // Log deployer info with simulation indicator for fork modes
        bool isSimulation = state == State.FORK_TEST ||
            state == State.FORK_DEPLOYING;
        log.logDeployer(deployer, isSimulation);

        // ===== Step 3: Start Transaction Context =====
        // Real deployments use broadcast (actual txs), forks use prank (simulated)
        if (state == State.REAL_DEPLOYING) {
            vm.startBroadcast(deployer);
        } else if (isSimulation) {
            vm.startPrank(deployer);
        } else {
            revert("Invalid deployment state");
        }

        // ===== Step 4: Execute Deployment Logic =====
        // Call the child contract's _execute() implementation
        log.section(string.concat("Executing: ", name));
        _execute();
        log.endSection();

        // ===== Step 5: End Transaction Context =====
        if (state == State.REAL_DEPLOYING) {
            vm.stopBroadcast();
        } else if (isSimulation) {
            vm.stopPrank();
        }

        // ===== Step 6: Persist Deployed Contracts =====
        // Save all contracts recorded via _recordDeployment() to the Resolver
        _storeContracts();

        // ===== Step 7: Build Governance Proposal =====
        // Call the child contract's _buildGovernanceProposal() if implemented
        _buildGovernanceProposal();

        // ===== Step 8: Record Execution =====
        // Record execution with correct governance metadata (must be after _buildGovernanceProposal)
        _recordExecution();

        // ===== Step 9: Handle Governance Proposal =====
        if (govProposal.actions.length == 0) {
            log.info("No governance proposal to handle");
        } else {
            // Ensure proposal has a description for clarity
            require(
                bytes(govProposal.description).length != 0,
                "Governance proposal missing description"
            );

            // Process governance proposal based on state
            if (state == State.REAL_DEPLOYING) {
                // Real deployment: output proposal data for manual submission
                GovHelper.logProposalData(log, govProposal);
            } else if (isSimulation) {
                // Fork mode: simulate proposal execution to verify it works
                GovHelper.simulate(log, govProposal);
            }
        }

        // ===== Step 10: Run Fork-Specific Logic =====
        // Execute any additional testing logic defined in _fork()
        if (isSimulation) _fork();
    }

    // ==================== Contract Recording ==================== //

    /// @notice Records a newly deployed contract for later persistence.
    /// @dev Call this in _execute() after deploying each contract.
    ///      The contract will be:
    ///      1. Added to the local contracts array
    ///      2. Logged for visibility
    ///      3. Persisted to Resolver in _storeDeployedContract()
    ///
    ///      Example usage in _execute():
    ///      ```
    ///      MyContract impl = new MyContract();
    ///      _recordDeployment("MY_CONTRACT_IMPL", address(impl));
    ///      ```
    /// @param contractName Identifier for the contract (e.g., "LIDO_ARM", "ETHENA_ARM_IMPL")
    /// @param implementation The deployed contract address
    function _recordDeployment(
        string memory contractName,
        address implementation
    ) internal virtual {
        // Add to local array for batch persistence later
        contracts.push(
            Contract({ implementation: implementation, name: contractName })
        );

        // Log the deployment for visibility
        log.logContractDeployed(contractName, implementation);
    }

    /// @notice Persists all recorded contracts to the Resolver (without recording execution).
    /// @dev Called automatically during run() before _buildGovernanceProposal().
    ///      Iterates through all contracts added via _recordDeployment() and
    ///      registers them in the global Resolver for cross-script access.
    function _storeContracts() internal virtual {
        for (uint256 i = 0; i < contracts.length; i++) {
            resolver.addContract(
                contracts[i].name,
                contracts[i].implementation
            );
        }
    }

    /// @notice Records execution with governance metadata.
    /// @dev Must be called AFTER _buildGovernanceProposal() so we know if governance is needed.
    ///      If no governance actions, uses NO_GOVERNANCE for proposalId and GOVERNANCE_PENDING (0)
    ///      for tsGovernance. This means fork tests will compile the script and call runFork()
    ///      on every run. The _fork() implementation should be idempotent (check on-chain state
    ///      before acting) so this is safe but adds minor overhead.
    ///
    ///      For scripts that have NO pending manual actions, manually set tsGovernance to
    ///      NO_GOVERNANCE (1) in the deployment JSON to skip compilation entirely in fork tests.
    ///      This is the recommended default once all on-chain actions are confirmed.
    ///
    ///      If governance actions exist, both default to GOVERNANCE_PENDING (0).
    function _recordExecution() internal virtual {
        uint256 proposalId;
        uint256 tsGovernance;
        if (govProposal.actions.length == 0) {
            proposalId = NO_GOVERNANCE;
        }
        resolver.addExecution(name, block.timestamp, proposalId, tsGovernance);
    }

    // ==================== Virtual Hooks (Override in Child Contracts) ==================== //

    /// @notice Runs only the fork-specific logic for already-deployed scripts.
    /// @dev Called by DeployManager when a script is already recorded in the
    ///      deployment history but has pending manual actions (tsGovernance == 0).
    ///      Unlike run(), this does NOT call _execute() or _buildGovernanceProposal().
    function runFork() external {
        state = resolver.getState();
        log = state != State.FORK_TEST || forcedLog;
        _fork();
    }

    /// @notice Hook for post-deployment fork testing logic.
    /// @dev Override this to run additional logic after deployment in fork mode.
    ///      Useful for:
    ///      - Testing upgrade paths
    ///      - Verifying state after governance proposal simulation
    ///      - Integration testing with other contracts
    ///
    ///      Called in two scenarios:
    ///      1. During run() for fresh deployments (state variables from _execute() are available)
    ///      2. Via runFork() for already-deployed scripts (state variables are NOT available)
    ///
    ///      IMPORTANT: _fork() may be called without _execute() (via runFork()), so
    ///      always use resolver.resolve() to look up contract addresses instead of
    ///      relying on state variables set in _execute().
    function _fork() internal virtual {}

    /// @notice Main deployment logic - MUST be implemented by child contracts.
    /// @dev Override this to define your deployment steps.
    ///      Use _recordDeployment() to register each deployed contract.
    ///      Use resolver.resolve("NAME") to get previously deployed addresses.
    ///
    ///      Example:
    ///      ```
    ///      function _execute() internal override {
    ///          address proxy = resolver.resolve("MY_PROXY");
    ///          MyImpl impl = new MyImpl();
    ///          _recordDeployment("MY_IMPL", address(impl));
    ///      }
    ///      ```
    function _execute() internal virtual {}

    /// @notice Hook to define governance proposal actions.
    /// @dev Override this to add actions that require governance execution.
    ///      Use govProposal.action() to add each action.
    ///
    ///      Example:
    ///      ```
    ///      function _buildGovernanceProposal() internal override {
    ///          govProposal.setDescription("Upgrade MyContract");
    ///          govProposal.action(
    ///              resolver.resolve("MY_PROXY"),
    ///              "upgradeTo(address)",
    ///              abi.encode(resolver.resolve("MY_IMPL"))
    ///          );
    ///      }
    ///      ```
    function _buildGovernanceProposal() internal virtual {}

    function buildGovernanceProposal() external virtual returns (uint256) {
        _buildGovernanceProposal();
        return GovHelper.id(govProposal);
    }

    // ==================== External View Functions ==================== //

    /// @notice Determines if this deployment script should be skipped.
    /// @dev Override to return true to skip execution.
    ///      Useful for temporarily disabling scripts without removing them.
    ///      Checked by DeployManager._runDeployFile() before execution.
    /// @return True to skip this script, false to execute
    function skip() external view virtual returns (bool) {}

    /// @notice Handles governance proposal when deployment was already done.
    /// @dev Called by DeployManager when script is in history but governance is pending.
    ///      Override to implement proposal resubmission or status checking logic.
    function handleGovernanceProposal() external virtual {
        _buildGovernanceProposal();
        log.simulate(govProposal);
    }
}
