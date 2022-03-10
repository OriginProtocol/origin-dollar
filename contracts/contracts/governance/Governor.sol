// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "./../timelock/Timelock.sol";

// Modeled off of Compound's Governor Alpha
//    https://github.com/compound-finance/compound-protocol/blob/master/contracts/Governance/GovernorAlpha.sol
contract Governor is Timelock {
    // @notice The total number of proposals
    uint256 public proposalCount;

    struct Proposal {
        // @notice Unique id for looking up a proposal
        uint256 id;
        // @notice Creator of the proposal
        address proposer;
        // @notice The timestamp that the proposal will be available for
        // execution, set once the vote succeeds
        uint256 eta;
        // @notice the ordered list of target addresses for calls to be made
        address[] targets;
        // @notice The ordered list of function signatures to be called
        string[] signatures;
        // @notice The ordered list of calldata to be passed to each call
        bytes[] calldatas;
        // @notice Flag marking whether the proposal has been executed
        bool executed;
    }

    // @notice The official record of all proposals ever proposed
    mapping(uint256 => Proposal) public proposals;

    // @notice An event emitted when a new proposal is created
    event ProposalCreated(
        uint256 id,
        address proposer,
        address[] targets,
        string[] signatures,
        bytes[] calldatas,
        string description
    );

    // @notice An event emitted when a proposal has been queued in the Timelock
    event ProposalQueued(uint256 id, uint256 eta);

    // @notice An event emitted when a proposal has been executed in the Timelock
    event ProposalExecuted(uint256 id);

    // @notice An event emitted when a proposal has been cancelled
    event ProposalCancelled(uint256 id);

    uint256 public constant MAX_OPERATIONS = 32;

    // @notice Possible states that a proposal may be in
    enum ProposalState {
        Pending,
        Queued,
        Expired,
        Executed
    }

    constructor(address admin_, uint256 delay_) Timelock(admin_, delay_) {}

    /**
     * @notice Propose Governance call(s)
     * @param targets Ordered list of targeted addresses
     * @param signatures Orderd list of function signatures to be called
     * @param calldatas Orderded list of calldata to be passed with each call
     * @param description Description of the governance
     * @return uint256 id of the proposal
     */
    function propose(
        address[] memory targets,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) public returns (uint256) {
        // Allow anyone to propose for now, since only admin can queue the
        // transaction it should be harmless, you just need to pay the gas
        require(
            targets.length == signatures.length &&
                targets.length == calldatas.length,
            "Governor::propose: proposal function information arity mismatch"
        );
        require(targets.length != 0, "Governor::propose: must provide actions");
        require(
            targets.length <= MAX_OPERATIONS,
            "Governor::propose: too many actions"
        );

        proposalCount++;
        Proposal memory newProposal = Proposal({
            id: proposalCount,
            proposer: msg.sender,
            eta: 0,
            targets: targets,
            signatures: signatures,
            calldatas: calldatas,
            executed: false
        });

        proposals[newProposal.id] = newProposal;

        emit ProposalCreated(
            newProposal.id,
            msg.sender,
            targets,
            signatures,
            calldatas,
            description
        );
        return newProposal.id;
    }

    /**
     * @notice Queue a proposal for execution
     * @param proposalId id of the proposal to queue
     */
    function queue(uint256 proposalId) public onlyAdmin {
        require(
            state(proposalId) == ProposalState.Pending,
            "Governor::queue: proposal can only be queued if it is pending"
        );
        Proposal storage proposal = proposals[proposalId];
        proposal.eta = block.timestamp + delay;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            _queueOrRevert(
                proposal.targets[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }

        emit ProposalQueued(proposal.id, proposal.eta);
    }

    /**
     * @notice Get the state of a proposal
     * @param proposalId id of the proposal
     * @return ProposalState
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        require(
            proposalCount >= proposalId && proposalId > 0,
            "Governor::state: invalid proposal id"
        );
        Proposal storage proposal = proposals[proposalId];
        if (proposal.executed) {
            return ProposalState.Executed;
        } else if (proposal.eta == 0) {
            return ProposalState.Pending;
        } else if (block.timestamp >= proposal.eta + GRACE_PERIOD) {
            return ProposalState.Expired;
        } else {
            return ProposalState.Queued;
        }
    }

    function _queueOrRevert(
        address target,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) internal {
        require(
            !queuedTransactions[
                keccak256(abi.encode(target, signature, keccak256(data), eta))
            ],
            "Governor::_queueOrRevert: proposal action already queued at eta"
        );
        require(
            queuedTransactions[queueTransaction(target, signature, data, eta)],
            "Governor::_queueOrRevert: failed to queue transaction"
        );
    }

    /**
     * @notice Execute a proposal.
     * @param proposalId id of the proposal
     */
    function execute(uint256 proposalId) public {
        require(
            state(proposalId) == ProposalState.Queued,
            "Governor::execute: proposal can only be executed if it is queued"
        );
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            executeTransaction(
                proposal.targets[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }
        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Cancel a proposal.
     * @param proposalId id of the proposal
     */
    function cancel(uint256 proposalId) public onlyAdmin {
        ProposalState proposalState = state(proposalId);

        require(
            proposalState == ProposalState.Queued ||
                proposalState == ProposalState.Pending,
            "Governor::execute: proposal can only be cancelled if it is queued or pending"
        );
        Proposal storage proposal = proposals[proposalId];
        proposal.eta = 1; // To mark the proposal as `Expired`
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            cancelTransaction(
                proposal.targets[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }
        emit ProposalCancelled(proposalId);
    }

    /**
     * @notice Get the actions that a proposal will take.
     * @param proposalId id of the proposal
     */
    function getActions(uint256 proposalId)
        public
        view
        returns (
            address[] memory targets,
            string[] memory signatures,
            bytes[] memory calldatas
        )
    {
        Proposal storage p = proposals[proposalId];
        return (p.targets, p.signatures, p.calldatas);
    }
}
