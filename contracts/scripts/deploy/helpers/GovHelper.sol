// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Foundry
import { Vm } from "forge-std/Vm.sol";

// Helpers
import { Logger } from "scripts/deploy/helpers/Logger.sol";
import { GovAction, GovProposal } from "scripts/deploy/helpers/DeploymentTypes.sol";

// Utils
import { Mainnet } from "tests/utils/Addresses.sol";

/// @title GovHelper
/// @notice Library for building, encoding, and simulating governance proposals.
/// @dev This library provides utilities for:
///      - Building governance proposals with actions
///      - Computing proposal IDs matching on-chain calculation
///      - Encoding calldata for proposal submission
///      - Simulating full proposal lifecycle on forks
///
///      Usage in deployment scripts:
///      ```
///      function _buildGovernanceProposal() internal override {
///          govProposal.setDescription("My Proposal");
///          govProposal.action(targetAddress, "functionName(uint256)", abi.encode(value));
///      }
///      ```
///
///      The library handles two modes:
///      - Real deployment: Outputs proposal calldata for manual submission
///      - Fork testing: Simulates full proposal lifecycle (create → vote → queue → execute)
library GovHelper {
    using Logger for bool;

    // ==================== Constants ==================== //

    /// @notice Foundry's VM cheat code contract instance.
    /// @dev Used for fork manipulation (vm.prank, vm.roll, vm.warp) during simulation.
    Vm internal constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    // ==================== Proposal ID Calculation ==================== //

    /// @notice Computes the unique proposal ID matching the on-chain governance contract.
    /// @dev The ID is calculated as: keccak256(abi.encode(targets, values, calldatas, descriptionHash))
    ///      This matches the OpenZeppelin Governor contract's proposal ID calculation.
    /// @param prop The governance proposal to compute the ID for
    /// @return proposalId The unique identifier for this proposal
    function id(GovProposal memory prop)
        internal
        pure
        returns (uint256 proposalId)
    {
        // Hash the description string for inclusion in proposal ID
        bytes32 descriptionHash = keccak256(bytes(prop.description));

        // Extract proposal parameters
        (
            address[] memory targets,
            uint256[] memory values,
            ,
            ,
            bytes[] memory calldatas
        ) = getParams(prop);

        // Compute the proposal ID matching on-chain calculation
        proposalId = uint256(
            keccak256(abi.encode(targets, values, calldatas, descriptionHash))
        );
    }

    // ==================== Parameter Extraction ==================== //

    /// @notice Extracts all parameters from a proposal in the format expected by governance.
    /// @dev Returns both raw parameters (sigs, data) and encoded calldatas.
    ///      The governance contract accepts either format depending on the propose function used.
    /// @param prop The governance proposal to extract parameters from
    /// @return targets Array of contract addresses to call
    /// @return values Array of ETH values to send with each call
    /// @return sigs Array of function signatures (e.g., "upgradeTo(address)")
    /// @return data Array of ABI-encoded parameters (without selectors)
    /// @return calldatas Array of complete calldata (selector + encoded params)
    function getParams(GovProposal memory prop)
        internal
        pure
        returns (
            address[] memory targets,
            uint256[] memory values,
            string[] memory sigs,
            bytes[] memory data,
            bytes[] memory calldatas
        )
    {
        uint256 actionLen = prop.actions.length;
        targets = new address[](actionLen);
        values = new uint256[](actionLen);

        sigs = new string[](actionLen);
        data = new bytes[](actionLen);

        for (uint256 i = 0; i < actionLen; ++i) {
            targets[i] = prop.actions[i].target;
            values[i] = prop.actions[i].value;
            sigs[i] = prop.actions[i].fullsig;
            data[i] = prop.actions[i].data;
        }

        // Encode signatures + data into complete calldatas
        calldatas = _encodeCalldata(sigs, data);
    }

    // ==================== Internal Encoding ==================== //

    /// @notice Encodes function signatures and parameters into complete calldata.
    /// @dev Combines 4-byte selectors (from signatures) with encoded parameters.
    ///      If signature is empty, uses the calldata as-is (for raw calls).
    /// @param signatures Array of function signatures
    /// @param calldatas Array of ABI-encoded parameters
    /// @return fullcalldatas Array of complete calldata (selector + params)
    function _encodeCalldata(
        string[] memory signatures,
        bytes[] memory calldatas
    ) private pure returns (bytes[] memory) {
        bytes[] memory fullcalldatas = new bytes[](calldatas.length);

        for (uint256 i = 0; i < signatures.length; ++i) {
            // If signature is empty, use raw calldata; otherwise prepend selector
            fullcalldatas[i] = bytes(signatures[i]).length == 0
                ? calldatas[i]
                : abi.encodePacked(
                    bytes4(keccak256(bytes(signatures[i]))),
                    calldatas[i]
                );
        }

        return fullcalldatas;
    }

    // ==================== Proposal Building ==================== //

    /// @notice Sets the description for a governance proposal.
    /// @dev The description is included in the on-chain proposal and affects the proposal ID.
    /// @param prop The proposal storage reference to modify
    /// @param description Human-readable description of the proposal
    function setDescription(GovProposal storage prop, string memory description)
        internal
    {
        prop.description = description;
    }

    /// @notice Adds an action to a governance proposal.
    /// @dev Actions are executed sequentially when the proposal passes.
    ///      Value is set to 0 (no ETH transfer). For payable calls, modify directly.
    /// @param prop The proposal storage reference to modify
    /// @param target The contract address to call
    /// @param fullsig The function signature (e.g., "upgradeTo(address)")
    /// @param data ABI-encoded function parameters
    function action(
        GovProposal storage prop,
        address target,
        string memory fullsig,
        bytes memory data
    ) internal {
        prop.actions.push(
            GovAction({
                target: target,
                fullsig: fullsig,
                data: data,
                value: 0
            })
        );
    }

    // ==================== Calldata Generation ==================== //

    /// @notice Generates the complete calldata for submitting a proposal on-chain.
    /// @dev Creates calldata for the Governor's propose() function.
    ///      Can be used directly with cast or other tools for manual submission.
    /// @param prop The proposal to generate calldata for
    /// @return proposeCalldata The encoded propose() function call
    function getProposeCalldata(GovProposal memory prop)
        internal
        pure
        returns (bytes memory proposeCalldata)
    {
        // Extract all proposal parameters
        (
            address[] memory targets,
            uint256[] memory values,
            string[] memory sigs,
            bytes[] memory data,

        ) = getParams(prop);

        // Encode the propose function call
        proposeCalldata = abi.encodeWithSignature(
            "propose(address[],uint256[],string[],bytes[],string)",
            targets,
            values,
            sigs,
            data,
            prop.description
        );
    }

    // ==================== Real Deployment Output ==================== //

    /// @notice Logs proposal data for manual submission during real deployments.
    /// @dev Used when state is REAL_DEPLOYING to output calldata for off-chain submission.
    ///      Reverts if the proposal already exists on-chain.
    /// @param log Whether logging is enabled
    /// @param prop The proposal to log calldata for
    function logProposalData(bool log, GovProposal memory prop) internal view {
        IGovernance governance = IGovernance(Mainnet.GovernorSix);

        // Ensure proposal doesn't already exist
        require(
            governance.proposalSnapshot(id(prop)) == 0,
            "Proposal already exists"
        );

        // Output the proposal calldata for manual submission
        log.logGovProposalHeader();
        log.logCalldata(address(governance), getProposeCalldata(prop));
    }

    // ==================== Fork Simulation ==================== //

    /// @notice Simulates the complete governance proposal lifecycle on a fork.
    /// @dev Executes the full proposal flow: create → vote → queue → execute.
    ///      Uses vm.prank to impersonate the governance multisig.
    ///      Manipulates block number and timestamp to bypass voting delays.
    ///
    ///      Lifecycle stages:
    ///      1. Pending: Proposal created, waiting for voting delay
    ///      2. Active: Voting period open
    ///      3. Succeeded: Voting passed, ready for queue
    ///      4. Queued: In timelock, waiting for execution delay
    ///      5. Executed: Proposal actions have been executed
    ///
    /// @param log Whether logging is enabled
    /// @param prop The proposal to simulate
    function simulate(bool log, GovProposal memory prop) internal {
        // ===== Setup: Label addresses for trace readability =====
        address govMultisig = Mainnet.Timelock;
        vm.label(govMultisig, "Gov Multisig");

        IGovernance governance = IGovernance(Mainnet.GovernorSix);
        vm.label(address(governance), "Governance");

        // ===== Compute proposal ID =====
        uint256 proposalId = id(prop);

        // ===== Check if proposal already exists =====
        uint256 snapshot = governance.proposalSnapshot(proposalId);

        // ===== Stage 1: Create Proposal =====
        if (snapshot == 0) {
            bytes memory proposeData = getProposeCalldata(prop);

            // Log the proposal calldata for reference
            log.logGovProposalHeader();
            log.logCalldata(address(governance), proposeData);

            // Create the proposal by impersonating the governance multisig
            log.info("Simulation of the governance proposal:");
            log.info("Creating proposal on fork...");
            vm.prank(govMultisig);
            (bool success, ) = address(governance).call(proposeData);
            if (!success) {
                revert("Fail to create proposal");
            }
            log.success("Proposal created");
        }

        // Get current proposal state
        IGovernance.ProposalState state = governance.state(proposalId);

        // ===== Early exit if already executed =====
        if (state == IGovernance.ProposalState.Executed) {
            log.success("Proposal already executed");
            return;
        }

        // ===== Stage 2: Wait for Voting Period =====
        if (state == IGovernance.ProposalState.Pending) {
            log.info("Waiting for voting period...");
            // Fast-forward past the voting delay
            vm.roll(block.number + governance.votingDelay() + 1);
            vm.warp(block.timestamp + 1 minutes);

            state = governance.state(proposalId);
        }

        // ===== Stage 3: Cast Vote =====
        if (state == IGovernance.ProposalState.Active) {
            log.info("Voting on proposal...");
            // Cast a "For" vote (support = 1) as the governance multisig
            vm.prank(govMultisig);
            governance.castVote(proposalId, 1);

            // Fast-forward past the voting period end
            vm.roll(governance.proposalDeadline(proposalId) + 20);
            vm.warp(block.timestamp + 2 days);
            log.success("Vote cast");

            state = governance.state(proposalId);
        }

        // ===== Stage 4: Queue Proposal =====
        if (state == IGovernance.ProposalState.Succeeded) {
            log.info("Queuing proposal...");
            // Queue the proposal in the timelock
            vm.prank(govMultisig);
            governance.queue(proposalId);
            log.success("Proposal queued");

            state = governance.state(proposalId);
        }

        // ===== Stage 5: Execute Proposal =====
        if (state == IGovernance.ProposalState.Queued) {
            log.info("Executing proposal...");
            // Fast-forward past the timelock delay
            uint256 propEta = governance.proposalEta(proposalId);
            vm.roll(block.number + 10);
            vm.warp(propEta + 20);

            // Execute the proposal actions
            vm.prank(govMultisig);
            governance.execute(proposalId);
            log.success("Proposal executed");

            state = governance.state(proposalId);
        }

        // ===== Verify Final State =====
        if (state != IGovernance.ProposalState.Executed) {
            log.error("Unexpected proposal state");
            revert("Unexpected proposal state");
        }
    }
}

// ==================== External Interface ==================== //

/// @title IGovernance
/// @notice Interface for the OpenZeppelin Governor contract used by the protocol.
/// @dev Defines the functions needed for proposal lifecycle management.
///      The actual governance contract is at Mainnet.GovernorSix.
interface IGovernance {
    /// @notice Enumeration of possible proposal states.
    /// @dev Proposals progress through these states during their lifecycle.
    enum ProposalState {
        Pending, // Created, waiting for voting delay
        Active, // Voting period is open
        Canceled, // Proposal was canceled by proposer
        Defeated, // Voting period ended with insufficient votes
        Succeeded, // Voting passed, ready for queue
        Queued, // In timelock, waiting for execution delay
        Expired, // Timelock period expired without execution
        Executed // Proposal actions have been executed
    }

    /// @notice Returns the current state of a proposal.
    /// @param proposalId The unique identifier of the proposal
    /// @return The current ProposalState
    function state(uint256 proposalId) external view returns (ProposalState);

    /// @notice Returns the block number at which voting snapshot was taken.
    /// @dev Returns 0 if the proposal doesn't exist.
    /// @param proposalId The unique identifier of the proposal
    /// @return The snapshot block number
    function proposalSnapshot(uint256 proposalId)
        external
        view
        returns (uint256);

    /// @notice Returns the block number at which voting ends.
    /// @param proposalId The unique identifier of the proposal
    /// @return The deadline block number
    function proposalDeadline(uint256 proposalId)
        external
        view
        returns (uint256);

    /// @notice Returns the timestamp at which the proposal can be executed.
    /// @dev Only valid for queued proposals.
    /// @param proposalId The unique identifier of the proposal
    /// @return The execution timestamp (ETA)
    function proposalEta(uint256 proposalId) external view returns (uint256);

    /// @notice Returns the voting delay in blocks.
    /// @dev Time between proposal creation and voting start.
    /// @return The voting delay in blocks
    function votingDelay() external view returns (uint256);

    /// @notice Casts a vote on a proposal.
    /// @param proposalId The unique identifier of the proposal
    /// @param support Vote type: 0 = Against, 1 = For, 2 = Abstain
    /// @return balance The voting weight of the voter
    function castVote(uint256 proposalId, uint8 support)
        external
        returns (uint256 balance);

    /// @notice Queues a successful proposal in the timelock.
    /// @dev Can only be called after voting succeeds.
    /// @param proposalId The unique identifier of the proposal
    function queue(uint256 proposalId) external;

    /// @notice Executes a queued proposal.
    /// @dev Can only be called after timelock delay passes.
    /// @param proposalId The unique identifier of the proposal
    function execute(uint256 proposalId) external;
}
