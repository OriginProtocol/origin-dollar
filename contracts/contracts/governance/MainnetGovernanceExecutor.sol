// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Governable } from "./Governable.sol";
import { QUEUE_PROPOSAL_COMMAND, CANCEL_PROPOSAL_COMMAND } from "./L2Governance.sol";
import { Initializable } from "../utils/Initializable.sol";

import { ARBITRUM_ONE_SELECTOR } from "../utils/CCIPChainSelectors.sol";

import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";

contract MainnetGovernanceExecutor is Governable, Initializable {
    /***************************************
                    Events
    ****************************************/
    /**
     * @dev Emitted whenever a command is forwarded to CCIP Router
     */
    event CommandSentToCCIPRouter(
        uint64 indexed chainSelector,
        bytes32 messageId,
        bytes2 commandSelector,
        uint256 proposalId
    );
    /**
     * @dev Emitted when a Chain Config is added
     */
    event ChainConfigAdded(
        uint64 indexed chainSelector,
        address indexed l2Governance
    );
    /**
     * @dev Emitted when a Chain Config is removed
     */
    event ChainConfigRemoved(uint64 indexed chainSelector);

    /***************************************
                    Errors
    ****************************************/
    error UnsupportedChain(uint64 chainSelector);
    error InsufficientBalanceForFees(uint256 feesRequired);
    error DuplicateChainConfig(uint64 chainSelector);
    error InvalidGovernanceCommand(bytes2 command);
    error InvalidInitializationArgLength();
    error InvalidGovernanceAddress();

    /***************************************
                    Storage
    ****************************************/
    address public immutable ccipRouter;

    struct ChainConfig {
        bool isSupported;
        address l2Governance;
    }
    /**
     * @dev All supported chains
     */
    mapping(uint64 => ChainConfig) public chainConfig;

    constructor(address _ccipRouter) {
        ccipRouter = _ccipRouter;
    }

    function initialize(
        uint64[] calldata chainSelectors,
        address[] calldata l2Governances
    ) public initializer {
        if (chainSelectors.length != l2Governances.length) {
            revert InvalidInitializationArgLength();
        }

        for (uint256 i = 0; i < chainSelectors.length; ++i) {
            _addChainConfig(chainSelectors[i], l2Governances[i]);
        }
    }

    /***************************************
                    CCIP
    ****************************************/
    /**
     * @dev Send a command to queue/cancel a L2 Proposal through CCIP Router
     * @param commandSelector Command to send
     * @param chainSelector Destination chain
     * @param proposalId L2 Proposal ID
     * @param maxGasLimit Max Gas Limit to use
     */
    function _sendCommandToL2(
        bytes2 commandSelector,
        uint64 chainSelector,
        uint256 proposalId,
        uint256 maxGasLimit
    ) internal {
        // Ensure it's a valid command
        if (
            commandSelector != QUEUE_PROPOSAL_COMMAND &&
            commandSelector != CANCEL_PROPOSAL_COMMAND
        ) {
            revert InvalidGovernanceCommand(commandSelector);
        }

        ChainConfig memory config = chainConfig[chainSelector];

        // Ensure it's a supported chain
        if (!config.isSupported) {
            revert UnsupportedChain(chainSelector);
        }

        // Build the command data
        bytes memory data = abi.encode(
            // Command Selector
            commandSelector,
            // Encoded Command Data
            abi.encode(proposalId)
        );

        bytes memory extraArgs = hex"";

        // Set gas limit if needed
        if (maxGasLimit > 0) {
            extraArgs = Client._argsToBytes(
                // Set gas limit
                Client.EVMExtraArgsV1({ gasLimit: maxGasLimit })
            );
        }

        // Build the message
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(config.l2Governance),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: extraArgs,
            feeToken: address(0)
        });

        IRouterClient router = IRouterClient(ccipRouter);

        // Compute fees
        uint256 fees = router.getFee(chainSelector, message);

        // Ensure the contract has enough balance to pay the fees
        if (fees > address(this).balance) {
            revert InsufficientBalanceForFees(fees);
        }

        // Forward to CCIP Router
        // slither-disable-next-line arbitrary-send-eth
        bytes32 messageId = router.ccipSend{ value: fees }(
            chainSelector,
            message
        );

        emit CommandSentToCCIPRouter(
            chainSelector,
            messageId,
            commandSelector,
            proposalId
        );
    }

    /**
     * @dev Send a command to queue/cancel a L2 Proposal through CCIP Router.
     *      Has to come through Governance
     * @param commandSelector Command to send
     * @param chainSelector Destination chain
     * @param proposalId L2 Proposal ID
     * @param maxGasLimit Max Gas Limit to use
     */
    function sendCommandToL2(
        bytes2 commandSelector,
        uint64 chainSelector,
        uint256 proposalId,
        uint256 maxGasLimit
    ) external onlyGovernor {
        _sendCommandToL2(
            commandSelector,
            chainSelector,
            proposalId,
            maxGasLimit
        );
    }

    /**
     * @dev Send a command to queue a L2 Proposal through CCIP Router.
     *      Has to come through Governance
     * @param chainSelector Destination chain
     * @param proposalId L2 Proposal ID
     * @param maxGasLimit Max Gas Limit to use
     */
    function queueL2Proposal(
        uint64 chainSelector,
        uint256 proposalId,
        uint256 maxGasLimit
    ) external onlyGovernor {
        _sendCommandToL2(
            QUEUE_PROPOSAL_COMMAND,
            chainSelector,
            proposalId,
            maxGasLimit
        );
    }

    /**
     * @dev Send a command to cancel a L2 Proposal through CCIP Router.
     *      Has to come through Governance
     * @param chainSelector Destination chain
     * @param proposalId L2 Proposal ID
     * @param maxGasLimit Max Gas Limit to use
     */
    function cancelL2Proposal(
        uint64 chainSelector,
        uint256 proposalId,
        uint256 maxGasLimit
    ) external onlyGovernor {
        _sendCommandToL2(
            CANCEL_PROPOSAL_COMMAND,
            chainSelector,
            proposalId,
            maxGasLimit
        );
    }

    /***************************************
                Configuration
    ****************************************/
    /**
     * @dev Add a L2 Chain to forward commands to.
     *      Has to go through Governance
     * @param chainSelector New timelock address
     * @param l2Governance New timelock address
     */
    function addChainConfig(uint64 chainSelector, address l2Governance)
        external
        onlyGovernor
    {
        _addChainConfig(chainSelector, l2Governance);
    }

    function _addChainConfig(uint64 chainSelector, address l2Governance)
        internal
    {
        if (chainConfig[chainSelector].isSupported) {
            revert DuplicateChainConfig(chainSelector);
        }

        if (l2Governance == address(0)) {
            revert InvalidGovernanceAddress();
        }

        chainConfig[chainSelector] = ChainConfig({
            isSupported: true,
            l2Governance: l2Governance
        });

        emit ChainConfigAdded(chainSelector, l2Governance);
    }

    /**
     * @dev Remove a supported L2 chain.
     *      Has to go through Governance
     * @param chainSelector New timelock address
     */
    function removeChainConfig(uint64 chainSelector) external onlyGovernor {
        if (!chainConfig[chainSelector].isSupported) {
            revert UnsupportedChain(chainSelector);
        }

        chainConfig[chainSelector] = ChainConfig({
            isSupported: false,
            l2Governance: address(0)
        });

        emit ChainConfigRemoved(chainSelector);
    }

    // Accept ETH
    receive() external payable {}
}
