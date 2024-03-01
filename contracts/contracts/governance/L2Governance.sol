// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { CCIPReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import { IARM } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IARM.sol";

import { MAINNET_SELECTOR } from "../utils/CCIPChainSelectors.sol";
import { Governable } from "./Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { ITimelockController } from "../interfaces/ITimelockController.sol";
import { ICCIPRouter } from "../interfaces/ICCIPRouter.sol";

bytes2 constant QUEUE_PROPOSAL_COMMAND = hex"0001";
bytes2 constant CANCEL_PROPOSAL_COMMAND = hex"0002";

contract L2Governance is Governable, Initializable, CCIPReceiver {
    /***************************************
                    Events
    ****************************************/
    /**
     * @dev Emitted when timelock address is changed
     */
    event TimelockChanged(
        address indexed oldTimelock,
        address indexed newTimelock
    );

    /**
     * @dev Emitted when timelock address is changed
     */
    event MainnetExectutorChanged(
        address indexed oldExecutor,
        address indexed newExecutor
    );

    /**
     * @dev Emitted when a proposal is created.
     */
    event ProposalCreated(
        uint256 indexed proposalId,
        address proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        string description
    );

    /**
     * @dev Emitted when a proposal is queued on the Timelock.
     */
    event ProposalQueued(uint256 indexed proposalId);

    /**
     * @dev Emitted when a proposal is canceled.
     */
    event ProposalCanceled(uint256 indexed proposalId);

    /**
     * @dev Emitted when a proposal has been executed.
     */
    event ProposalExecuted(uint256 indexed proposalId);

    /***************************************
                    Errors
    ****************************************/
    error NotMainnetExecutor();
    error NotL2Executor();
    error InvalidSourceChainSelector();
    error DuplicateProposal(uint256 proposalId);
    error InvalidProposal();
    error EmptyProposal();
    error InvalidProposalLength();
    error InvalidGovernanceCommand(bytes2 command);
    error ProposalAlreadyQueued(uint256 proposalId, bytes32 timelockHash);
    error EmptyAddress();
    error TokenTransfersNotAccepted();
    error CCIPRouterIsCursed();

    /***************************************
                    Storage
    ****************************************/
    // Returns the current state of a proposal
    enum ProposalState {
        Pending, // Proposal Created
        Queued, // Queued by Mainnet Governance
        Ready, // Ready to be Executed
        Executed
    }

    /**
     * @dev Mainnet Governance Exectuor
     */
    address public mainnetExecutor;

    /**
     * @dev L2 Timelock Controller
     */
    address private timelock;

    struct ProposalDetails {
        bool exists;
        address proposer;
        address[] targets;
        uint256[] values;
        string[] signatures;
        bytes[] calldatas;
        bytes32 descriptionHash;
    }

    /**
     * @dev Stores the details of the proposal by ID
     */
    mapping(uint256 => ProposalDetails) public proposalDetails;

    /***************************************
                    Modifiers
    ****************************************/
    /**
     * @dev Ensures that the requests are from Mainnet
     *      and from Governance Executor
     */
    modifier onlyMainnetGovernance(uint64 chainSelector, address sender) {
        if (chainSelector != MAINNET_SELECTOR) {
            // Ensure it's from mainnet
            revert InvalidSourceChainSelector();
        }

        if (sender != mainnetExecutor) {
            // Ensure it's from Mainnet Governance
            revert NotMainnetExecutor();
        }

        _;
    }

    /**
     * @dev Ensures that the calls are from L2 Timelock
     *      and from Governance Executor
     */
    modifier onlyL2Timelock() {
        if (msg.sender != timelock) {
            revert NotL2Executor();
        }

        _;
    }

    /**
     * @dev Reverts if CCIP's Risk Management contract (ARM) is cursed
     */
    modifier onlyIfNotCursed() {
        IARM arm = IARM(ICCIPRouter(this.getRouter()).getArmProxy());

        if (arm.isCursed()) {
            revert CCIPRouterIsCursed();
        }

        _;
    }

    /***************************************
                Constructor
    ****************************************/
    constructor(address l2Router_) CCIPReceiver(l2Router_) {
        if (l2Router_ == address(0)) {
            revert EmptyAddress();
        }
    }

    function initialize(address timelock_, address mainnetExecutor_)
        external
        initializer
    {
        if (timelock_ == address(0)) {
            revert EmptyAddress();
        }
        if (mainnetExecutor_ == address(0)) {
            revert EmptyAddress();
        }
        timelock = timelock_;
        mainnetExecutor = mainnetExecutor_;
    }

    /***************************************
                CCIPReceiver
    ****************************************/
    /**
     * @inheritdoc CCIPReceiver
     */
    function _ccipReceive(Client.Any2EVMMessage memory message)
        internal
        override
        onlyMainnetGovernance(
            message.sourceChainSelector,
            abi.decode(message.sender, (address))
        )
        onlyIfNotCursed
    {
        if (message.destTokenAmounts.length > 0) {
            revert TokenTransfersNotAccepted();
        }

        // Decode the command & message
        (bytes2 cmd, bytes memory cmdData) = abi.decode(
            message.data,
            (bytes2, bytes)
        );

        if (cmd == QUEUE_PROPOSAL_COMMAND) {
            // Queue actions
            uint256 proposalId = abi.decode(cmdData, (uint256));
            _queue(proposalId);
        } else if (cmd == CANCEL_PROPOSAL_COMMAND) {
            // Cancel proposal
            uint256 proposalId = abi.decode(cmdData, (uint256));
            _cancel(proposalId);
        } else {
            revert InvalidGovernanceCommand(cmd);
        }
    }

    /***************************************
                Governance
    ****************************************/
    /**
     * @dev L2 Executor is always same as Timelock
     */
    function executor() external view returns (address) {
        return timelock;
    }

    /**
     * @dev Returns the state of the proposal
     * @param proposalId The proposal ID
     * @return ProposalState
     */
    function state(uint256 proposalId) external view returns (ProposalState) {
        bytes32 timelockHash = _getTimelockHash(proposalId);
        ITimelockController controller = ITimelockController(timelock);

        if (controller.isOperationDone(timelockHash)) {
            return ProposalState.Executed;
        } else if (controller.isOperationReady(timelockHash)) {
            return ProposalState.Ready;
        } else if (controller.isOperationPending(timelockHash)) {
            return ProposalState.Queued;
        }

        return ProposalState.Pending;
    }

    /**
     * @dev Returns a unique ID for the given proposal args
     * @return Propsal ID
     */
    function hashProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public pure virtual returns (uint256) {
        return
            uint256(
                keccak256(
                    abi.encode(targets, values, calldatas, descriptionHash)
                )
            );
    }

    /**
     * @dev Returns the actions of a proposal
     */
    function getActions(uint256 proposalId)
        external
        view
        virtual
        returns (
            address[] memory,
            uint256[] memory,
            string[] memory,
            bytes[] memory
        )
    {
        ProposalDetails memory details = proposalDetails[proposalId];
        return (
            details.targets,
            details.values,
            details.signatures,
            details.calldatas
        );
    }

    /**
     * @dev Encodes calldatas with optional function signature.
     */
    function _encodeCalldata(
        string[] memory signatures,
        bytes[] memory calldatas
    ) private pure returns (bytes[] memory) {
        bytes[] memory fullcalldatas = new bytes[](calldatas.length);

        uint256 len = signatures.length;
        for (uint256 i = 0; i < len; ++i) {
            fullcalldatas[i] = bytes(signatures[i]).length == 0
                ? calldatas[i]
                : bytes.concat(
                    bytes4(keccak256(bytes(signatures[i]))),
                    calldatas[i]
                );
        }

        return fullcalldatas;
    }

    /**
     * @dev Store proposal metadata for later lookup
     */
    function _storeProposal(
        address proposer,
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) private returns (uint256) {
        if (
            targets.length != values.length ||
            targets.length != calldatas.length ||
            targets.length != signatures.length
        ) {
            revert InvalidProposalLength();
        }

        if (targets.length == 0) {
            revert EmptyProposal();
        }

        bytes32 descriptionHash = keccak256(bytes(description));
        uint256 proposalId = hashProposal(
            targets,
            values,
            _encodeCalldata(signatures, calldatas),
            descriptionHash
        );

        ProposalDetails storage details = proposalDetails[proposalId];

        if (details.exists) {
            revert DuplicateProposal(proposalId);
        }

        details.exists = true;
        details.proposer = proposer;
        details.targets = targets;
        details.values = values;
        details.signatures = signatures;
        details.calldatas = calldatas;
        details.descriptionHash = descriptionHash;

        emit ProposalCreated(
            proposalId,
            proposer,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            description
        );

        return proposalId;
    }

    /**
     * @dev Creates a proposal with the given args.
     *      Can be called by anyone
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) external virtual returns (uint256) {
        return
            _storeProposal(
                msg.sender,
                targets,
                values,
                signatures,
                calldatas,
                description
            );
    }

    /**
     * @dev Queues a proposal on the Timelock
     *      Private and only to be used by Mainnet Governance through CCIP Router
     */
    function _queue(uint256 proposalId) internal {
        ITimelockController controller = ITimelockController(timelock);
        ProposalDetails memory details = proposalDetails[proposalId];

        if (!details.exists) {
            revert InvalidProposal();
        }

        controller.scheduleBatch(
            details.targets,
            details.values,
            _encodeCalldata(details.signatures, details.calldatas),
            0,
            details.descriptionHash,
            controller.getMinDelay()
        );

        emit ProposalQueued(proposalId);
    }

    /**
     * @dev Cancels a pending proposal on the Timelock
     *      Private and only to be used by Mainnet Governance through CCIP Router
     */
    function _cancel(uint256 proposalId) internal {
        ITimelockController controller = ITimelockController(timelock);

        bytes32 timelockHash = _getTimelockHash(proposalId);

        proposalDetails[proposalId].exists = false;
        controller.cancel(timelockHash);

        emit ProposalCanceled(proposalId);
    }

    /**
     * @dev Returns the timelock hash for a proposal
     */
    function _getTimelockHash(uint256 proposalId)
        internal
        view
        returns (bytes32 timelockHash)
    {
        ITimelockController controller = ITimelockController(timelock);

        ProposalDetails memory details = proposalDetails[proposalId];

        if (!details.exists) {
            revert InvalidProposal();
        }

        timelockHash = controller.hashOperationBatch(
            details.targets,
            details.values,
            _encodeCalldata(details.signatures, details.calldatas),
            0,
            details.descriptionHash
        );
    }

    function getTimelockHash(uint256 proposalId)
        external
        view
        returns (bytes32)
    {
        return _getTimelockHash(proposalId);
    }

    /**
     * @dev Executes an already queued proposal on the Timelock.
     *      Can be called by anyone. Reverts if CCIP bridge
     *      status is cursed.
     * @param proposalId Proposal ID
     */
    function execute(uint256 proposalId) external payable onlyIfNotCursed {
        ITimelockController controller = ITimelockController(timelock);
        ProposalDetails memory details = proposalDetails[proposalId];

        if (!details.exists) {
            revert InvalidProposal();
        }

        controller.executeBatch{ value: msg.value }(
            details.targets,
            details.values,
            _encodeCalldata(details.signatures, details.calldatas),
            0,
            details.descriptionHash
        );

        emit ProposalExecuted(proposalId);
    }

    /***************************************
                Configuration
    ****************************************/
    /**
     * @dev Changes the address of the Timelock.
     *      Has to go through Timelock
     * @param timelock_ New timelock address
     */
    function setTimelock(address timelock_) external onlyL2Timelock {
        if (timelock_ == address(0)) {
            revert EmptyAddress();
        }
        emit TimelockChanged(timelock, timelock_);
        timelock = timelock_;
    }

    /**
     * @dev Changes the address of the Mainnet Executor.
     *      Has to go through Timelock
     * @param executor_ New Mainnet Executor address
     */
    function setMainnetExecutor(address executor_) external onlyL2Timelock {
        if (executor_ == address(0)) {
            revert EmptyAddress();
        }
        emit MainnetExectutorChanged(mainnetExecutor, executor_);
        mainnetExecutor = executor_;
    }
}
