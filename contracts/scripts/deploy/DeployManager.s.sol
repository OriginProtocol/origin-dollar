// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Foundry
import { Vm } from "forge-std/Vm.sol";
import { VmSafe } from "forge-std/Vm.sol";

// Helpers
import { Logger } from "scripts/deploy/helpers/Logger.sol";
import { AbstractDeployScript } from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import { State, Execution, Contract, Root, NO_GOVERNANCE } from "scripts/deploy/helpers/DeploymentTypes.sol";

// Script Base
import { Base } from "scripts/deploy/Base.s.sol";

/// @title DeployManager
/// @notice Manages the deployment of contracts across multiple chains (Mainnet, Sonic).
/// @dev This contract orchestrates the deployment process by:
///      1. Reading deployment scripts from chain-specific folders
///      2. Dynamically loading and executing only the most recent scripts
///      3. Tracking deployment history in JSON files to avoid re-deployments
///      4. Supporting both fork testing and real deployments
contract DeployManager is Base {
    using Logger for bool;

    // Unique identifier for fork deployment files, based on timestamp.
    // Used to create separate deployment tracking files during fork tests.
    string public forkFileId;

    // Raw JSON content of the deployment file, loaded during setUp.
    // Contains the history of deployed contracts and executed scripts.
    string public deployment;

    /// @notice Initializes the deployment environment before running scripts.
    /// @dev Called automatically by Forge before run(). Sets up:
    ///      - Deployment state (FORK_TEST, FORK_DEPLOYING, or REAL_DEPLOYING)
    ///      - Logging configuration
    ///      - Deployment JSON file (creates if doesn't exist)
    ///      - Fork-specific deployment file (to avoid polluting main deployment history)
    ///      - Resolver contract for address lookups
    function setUp() external virtual {
        // Determine deployment state based on Forge context
        // (test, dry-run, broadcast, etc.)
        setState();

        // Enable logging for non-fork-test states, or if forcedLog is set
        // Fork tests typically run silently unless debugging
        log = state != State.FORK_TEST || forcedLog;

        // Log the chain name and ID for visibility
        log.logSetup(chainNames[block.chainid], block.chainid);
        log.logKeyValue("State", _stateToString(state));

        // Build path to chain-specific deployment file
        // e.g., "build/deployments-1.json" for mainnet
        string memory deployFilePath = getChainDeploymentFilePath();

        // Initialize deployment file with empty arrays if it doesn't exist
        // This ensures we always have a valid JSON structure to parse
        if (!vm.isFile(deployFilePath)) {
            vm.writeFile(deployFilePath, '{"contracts": [], "executions": []}');
            log.info(
                string.concat("Created deployment file at: ", deployFilePath)
            );
            deployment = vm.readFile(deployFilePath);
        }

        // For fork states, create a separate deployment file to avoid
        // modifying the real deployment history during tests/dry-runs
        if (state == State.FORK_TEST || state == State.FORK_DEPLOYING) {
            // Use timestamp as unique identifier for this fork session
            forkFileId = string(abi.encodePacked(vm.toString(block.timestamp)));

            // Pause tracing to reduce noise in test output
            vm.pauseTracing();

            // Copy current deployment data to fork-specific file
            deployment = vm.readFile(deployFilePath);
            vm.writeFile(getForkDeploymentFilePath(), deployment);

            vm.resumeTracing();
        } else if (state == State.REAL_DEPLOYING) {
            // For real deployments, read the existing deployment file
            deployment = vm.readFile(deployFilePath);
        }

        // Deploy the Resolver contract which provides address lookups
        // for previously deployed contracts
        deployResolver();
    }

    // ==================== Main Deployment Runner ==================== //

    /// @notice Main entry point for running deployment scripts.
    /// @dev Execution flow:
    ///      1. Load existing deployment history into Resolver
    ///      2. Determine the correct script folder based on chain ID
    ///      3. Read all script files from the folder (sorted alphabetically)
    ///      4. Skip fully completed scripts (via _canSkipDeployFile)
    ///      5. For each remaining script: compile, deploy, and execute via _runDeployFile()
    ///      6. Save updated deployment history back to JSON
    function run() external virtual {
        // Load existing deployment data from JSON file into the Resolver
        _preDeployment();

        // Determine the deployment scripts folder path based on chain ID
        // - Chain ID 1 = Ethereum Mainnet -> use mainnet folder
        // - Chain ID 146 = Sonic -> use sonic folder
        // - Other chains = empty string (will revert)
        uint256 chainId = block.chainid;
        string memory path;
        if (chainId == 1) {
            path = string(
                abi.encodePacked(projectRoot, "/scripts/deploy/mainnet/")
            );
        } else if (chainId == 146) {
            path = string(
                abi.encodePacked(projectRoot, "/scripts/deploy/sonic/")
            );
        } else if (chainId == 8453) {
            path = string(
                abi.encodePacked(projectRoot, "/scripts/deploy/base/")
            );
        } else {
            revert("Unsupported chain");
        }

        // Read all files from the deployment scripts folder
        // Files are returned in alphabetical order (e.g., 001_..., 002_..., 003_...)
        vm.pauseTracing();
        VmSafe.DirEntry[] memory files = vm.readDir(path);
        vm.resumeTracing();

        // Iterate through ALL files, skipping those that are fully complete
        for (uint256 i; i < files.length; i++) {
            // Split the full file path by "/" to extract the filename
            // e.g., "/path/to/scripts/deploy/mainnet/015_UpgradeEthenaARMScript.sol"
            // ->    ["path", "to", ..., "015_UpgradeEthenaARMScript.sol"]
            string[] memory splitted = vm.split(files[i].path, "/");
            string memory onlyName = vm.split(
                splitted[splitted.length - 1],
                "."
            )[0];

            // Skip files that are fully complete (deployed + governance executed)
            if (_canSkipDeployFile(onlyName)) continue;

            // Deploy the script contract using vm.deployCode with just the filename
            // vm.deployCode compiles and deploys the contract, returning its address
            // Then call _runDeployFile to execute the deployment logic
            string memory contractName = string(
                abi.encodePacked(
                    projectRoot,
                    "/out/",
                    onlyName,
                    ".s.sol/$",
                    onlyName,
                    ".json"
                )
            );
            _runDeployFile(address(vm.deployCode(contractName)));
        }
        vm.resumeTracing();

        // Save all deployment data from Resolver back to JSON file
        _postDeployment();
    }

    /// @notice Executes a single deployment script with proper state checks.
    /// @dev Implements timestamp-based validation:
    ///      1. Check if script is marked to skip
    ///      2. Check if script was never deployed → run fresh deployment
    ///      3. Check governance metadata to determine if governance needs handling
    /// @param addr The address of the deployed AbstractDeployScript contract
    function _runDeployFile(address addr) internal {
        // Cast the address to AbstractDeployScript interface
        AbstractDeployScript deployFile = AbstractDeployScript(addr);

        // Skip if the script explicitly sets skip = true
        if (deployFile.skip()) return;

        // Get the script's unique name for history lookup
        string memory deployFileName = deployFile.name();

        // Label the contract address for better trace readability in Forge
        vm.label(address(deployFile), deployFileName);

        // If script was never deployed, run fresh deployment
        if (!resolver.executionExists(deployFileName)) {
            deployFile.run();
            return;
        }

        // Script was already deployed - check governance status
        uint256 proposalId = resolver.proposalIds(deployFileName);

        if (proposalId == NO_GOVERNANCE) {
            // Scripts reach here when tsGovernance == 0 (pending manual actions like
            // multisig proxy upgrades). Scripts with tsGovernance == NO_GOVERNANCE (1)
            // are already skipped by _canSkipDeployFile for speed.
            // The _fork() implementation should be idempotent — checking on-chain state
            // (e.g., proxy.implementation()) before acting, so it's safe to call repeatedly.
            bool isSimulation = state == State.FORK_TEST ||
                state == State.FORK_DEPLOYING;
            if (isSimulation) {
                log.section(string.concat("Running fork: ", deployFileName));
                deployFile.runFork();
                log.endSection();
            }
            return;
        }

        // proposalId == 0: governance pending (not yet submitted)
        if (proposalId == 0) {
            log.logSkip(deployFileName, "deployment already executed");
            log.info(
                string.concat(
                    "Handling governance proposal for ",
                    deployFileName
                )
            );
            deployFile.handleGovernanceProposal();
            return;
        }

        // proposalId > 1: governance submitted, check if executed
        uint256 tsGovernance = resolver.tsGovernances(deployFileName);
        if (tsGovernance != 0 && block.timestamp >= tsGovernance) {
            // Governance was executed at or before this fork point
            return;
        }

        // Governance not yet executed at this fork point
        log.logSkip(deployFileName, "deployment already executed");
        log.info(
            string.concat("Handling governance proposal for ", deployFileName)
        );
        deployFile.handleGovernanceProposal();
    }

    /// @notice Checks if a deployment file can be entirely skipped.
    /// @dev A file can be skipped if it's in the execution history AND
    ///      tsGovernance is non-zero and at/before the current block.
    ///      This covers:
    ///      - NO_GOVERNANCE scripts with tsGovernance == NO_GOVERNANCE (1): fully done, skip for speed
    ///      - Governance scripts with tsGovernance set to execution timestamp: fully done
    ///      Scripts with tsGovernance == 0 are NOT skipped, as they have pending actions
    ///      (governance proposals or manual actions like multisig upgrades).
    ///      Their _fork() should be idempotent (check on-chain state before acting).
    ///      Once all on-chain actions are confirmed, set tsGovernance to NO_GOVERNANCE (1)
    ///      in the deployment JSON to avoid unnecessary compilation in future fork tests.
    /// @param scriptName The unique name of the deployment script
    /// @return True if the file can be skipped (no need to compile/deploy)
    function _canSkipDeployFile(string memory scriptName)
        internal
        view
        returns (bool)
    {
        if (!resolver.executionExists(scriptName)) return false;
        uint256 tsGovernance = resolver.tsGovernances(scriptName);
        return tsGovernance != 0 && block.timestamp >= tsGovernance;
    }

    /// @notice Loads deployment history from JSON file into the Resolver.
    /// @dev Called at the start of run() to populate the Resolver with:
    ///      - Previously deployed contract addresses (for lookups via resolver.resolve())
    ///      - Previously executed script names (to avoid re-running deployments)
    ///      Filters out entries where tsDeployment > block.timestamp (future deployments).
    ///      Adjusts tsGovernance to 0 if it's in the future (governance not yet executed at fork point).
    ///      Uses pauseTracing modifier to reduce noise in Forge output.
    function _preDeployment() internal pauseTracing {
        // Parse the JSON deployment file into structured data
        Root memory root = abi.decode(vm.parseJson(deployment), (Root));

        // Load all deployed contract addresses into the Resolver
        // This allows scripts to lookup addresses via resolver.resolve("CONTRACT_NAME")
        for (uint256 i = 0; i < root.contracts.length; i++) {
            resolver.addContract(
                root.contracts[i].name,
                root.contracts[i].implementation
            );
        }

        // Load execution records into the Resolver with timestamp-based filtering
        for (uint256 i = 0; i < root.executions.length; i++) {
            Execution memory exec = root.executions[i];

            // Skip entries deployed after the current block (future deployments on historical fork)
            if (exec.tsDeployment > block.timestamp) continue;

            // Adjust tsGovernance: if governance happened after current block, treat as pending
            uint256 tsGovernance = exec.tsGovernance;
            if (
                tsGovernance > NO_GOVERNANCE && tsGovernance > block.timestamp
            ) {
                tsGovernance = 0;
            }

            resolver.addExecution(
                exec.name,
                exec.tsDeployment,
                exec.proposalId,
                tsGovernance
            );
        }
    }

    /// @notice Persists deployment data from Resolver back to JSON file.
    /// @dev Called at the end of run() to save:
    ///      - All contract addresses (existing + newly deployed)
    ///      - All execution records (existing + newly executed scripts)
    ///      Uses Forge's JSON serialization cheatcodes to build valid JSON.
    function _postDeployment() internal pauseTracing {
        // Fetch all data from the Resolver (includes new deployments)
        Contract[] memory contracts = resolver.getContracts();
        Execution[] memory executions = resolver.getExecutions();

        // Prepare arrays for JSON serialization
        string[] memory serializedContracts = new string[](contracts.length);
        string[] memory serializedExecutions = new string[](executions.length);

        // Serialize each contract as a JSON object: {"name": "...", "implementation": "0x..."}
        for (uint256 i = 0; i < contracts.length; i++) {
            vm.serializeString("c_obj", "name", contracts[i].name);
            serializedContracts[i] = vm.serializeAddress(
                "c_obj",
                "implementation",
                contracts[i].implementation
            );
        }

        // Serialize each execution with timestamp-based metadata
        for (uint256 i = 0; i < executions.length; i++) {
            vm.serializeString("e_obj", "name", executions[i].name);
            vm.serializeUint("e_obj", "proposalId", executions[i].proposalId);
            vm.serializeUint(
                "e_obj",
                "tsDeployment",
                executions[i].tsDeployment
            );
            serializedExecutions[i] = vm.serializeUint(
                "e_obj",
                "tsGovernance",
                executions[i].tsGovernance
            );
        }

        // Build the root JSON object with both arrays
        vm.serializeString("root", "contracts", serializedContracts);
        string memory finalJson = vm.serializeString(
            "root",
            "executions",
            serializedExecutions
        );

        // Write to the appropriate file (fork file or real deployment file)
        vm.writeFile(getDeploymentFilePath(), finalJson);
    }

    // ==================== Helper Functions ==================== //

    /// @notice Determines the deployment state based on Forge execution context.
    /// @dev Maps Forge contexts to our State enum:
    ///      - FORK_TEST: Running tests, coverage, or snapshots (simulated, no real txs)
    ///      - FORK_DEPLOYING: Dry-run mode (simulated deployment for testing)
    ///      - REAL_DEPLOYING: Actual deployment with real transactions
    ///      Reverts if unable to determine the context (should never happen in Forge).
    function setState() public {
        state = State.DEFAULT;

        // TestGroup includes: forge test, forge coverage, forge snapshot
        if (vm.isContext(VmSafe.ForgeContext.TestGroup)) {
            state = State.FORK_TEST;
        }
        // ScriptDryRun: forge script WITHOUT --broadcast (simulation only)
        else if (vm.isContext(VmSafe.ForgeContext.ScriptDryRun)) {
            state = State.FORK_DEPLOYING;
        }
        // ScriptResume: resuming a previously started broadcast
        else if (vm.isContext(VmSafe.ForgeContext.ScriptResume)) {
            state = State.REAL_DEPLOYING;
        }
        // ScriptBroadcast: forge script with --broadcast (real deployment)
        else if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            state = State.REAL_DEPLOYING;
        }

        require(state != State.DEFAULT, "Unable to determine deployment state");
    }

    /// @notice Deploys the Resolver contract to a deterministic address.
    /// @dev Uses vm.etch to place the Resolver bytecode at the predefined address.
    ///      This allows all scripts to access the same Resolver instance for
    ///      looking up previously deployed contract addresses.
    function deployResolver() public pauseTracing {
        // Get the compiled bytecode of the Resolver contract
        bytes memory resolverCode = vm.getDeployedCode("Resolver.sol:Resolver");

        // Place the bytecode at the resolver address (defined in Base contract)
        vm.etch(address(resolver), resolverCode);

        // Initialize the resolver with current state
        resolver.setState(state);

        // Label for better trace readability
        vm.label(address(resolver), "Resolver");
    }

    // ==================== Path Helper Functions ==================== //

    /// @notice Returns the path to the main deployment file for the current chain.
    /// @dev Format: "build/deployments-{chainId}.json"
    ///      Example: "build/deployments-1.json" for Ethereum Mainnet
    /// @return The full path to the deployment JSON file
    function getChainDeploymentFilePath() public view returns (string memory) {
        string memory chainIdStr = vm.toString(block.chainid);
        return
            string(
                abi.encodePacked(
                    projectRoot,
                    "/build/deployments-",
                    chainIdStr,
                    ".json"
                )
            );
    }

    /// @notice Returns the path to the fork-specific deployment file.
    /// @dev Format: "build/deployments-fork-{timestamp}.json"
    ///      Used during fork tests to avoid modifying the real deployment history.
    /// @return The full path to the fork deployment JSON file
    function getForkDeploymentFilePath() public view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    projectRoot,
                    "/build/deployments-fork-",
                    forkFileId,
                    ".json"
                )
            );
    }

    /// @notice Returns the appropriate deployment file path based on current state.
    /// @dev Routes to fork file for testing/dry-runs, chain file for real deployments.
    /// @return The path to use for reading/writing deployment data
    function getDeploymentFilePath() public view returns (string memory) {
        // Fork states use temporary files to avoid polluting real deployment history
        if (state == State.FORK_TEST || state == State.FORK_DEPLOYING) {
            return getForkDeploymentFilePath();
        }
        // Real deployments write to the permanent chain-specific file
        if (state == State.REAL_DEPLOYING) {
            return getChainDeploymentFilePath();
        }
        revert("Invalid state");
    }

    /// @notice Converts a State enum value to its string representation.
    /// @dev Used for logging and debugging purposes.
    /// @param _state The state to convert
    /// @return Human-readable string representation of the state
    function _stateToString(State _state)
        internal
        pure
        returns (string memory)
    {
        if (_state == State.FORK_TEST) return "FORK_TEST";
        if (_state == State.FORK_DEPLOYING) return "FORK_DEPLOYING";
        if (_state == State.REAL_DEPLOYING) return "REAL_DEPLOYING";
        return "DEFAULT";
    }
}
