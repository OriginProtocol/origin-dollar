// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { CCIPReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import { IARM } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IARM.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";

import { ICCIPRouter } from "../interfaces/chainlink/ICCIPRouter.sol";
import { Governable } from "../governance/Governable.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract AbstractDirectStakingHandler is CCIPReceiver, Governable {
    using SafeERC20 for IERC20;

    struct ChainConfig {
        bool isSupported;
        // Address of the Handler on the chain
        address handlerAddr;
    }

    mapping(uint64 => ChainConfig) public chainConfigs;

    // For future use
    uint256[49] private __gap;

    event ChainConfigAdded(uint64 chainId, address handlerAddr);
    event ChainConfigRemoved(uint64 chainId);

    /**
     * @dev Reverts if CCIP's Risk Management contract (ARM) is cursed
     */
    modifier onlyIfNotCursed() {
        IARM arm = IARM(ICCIPRouter(this.getRouter()).getArmProxy());

        require(!arm.isCursed(), "CCIP Router is cursed");

        _;
    }

    constructor(address _router) CCIPReceiver(_router) {
        // TODO: Change to address(0) later
        _setGovernor(msg.sender);
    }

    /**
     * @dev Adds a chain config
     */
    function addChainConfig(uint64 chainId, address _handler)
        external
        onlyGovernor
    {
        require(!chainConfigs[chainId].isSupported, "Chain config exists");

        emit ChainConfigAdded(chainId, _handler);

        chainConfigs[chainId] = ChainConfig({
            isSupported: true,
            handlerAddr: _handler
        });
    }

    /**
     * @dev Removes a chain config
     */
    function removeChainConfig(uint64 chainId) external onlyGovernor {
        require(chainConfigs[chainId].isSupported, "Unknown chain ID");

        emit ChainConfigRemoved(chainId);

        delete chainConfigs[chainId];
    }

    /**
     * @dev Returns the CCIP fees that the contract needs to execute the command
     * @param chainSelector Destination chain
     * @param data Message data
     * @param tokenAddr Token to send
     * @param tokenAmount Amount of tokens to send
     * @param maxGasLimit Max Gas Limit to use
     */
    function getCCIPFees(
        uint64 chainSelector,
        bytes memory data,
        address tokenAddr,
        uint256 tokenAmount,
        uint256 maxGasLimit
    ) external view returns (uint256) {
        // Build the message
        (, uint256 fee) = _buildCCIPMessage(
            chainSelector,
            data,
            tokenAddr,
            tokenAmount,
            maxGasLimit
        );

        return fee;
    }

    /**
     * @dev Builds the CCIP message
     * @param chainSelector Destination chain
     * @param data Message data
     * @param tokenAddr Token to send
     * @param tokenAmount Amount of tokens to send
     * @param maxGasLimit Max Gas Limit to use
     */
    function _buildCCIPMessage(
        uint64 chainSelector,
        bytes memory data,
        address tokenAddr,
        uint256 tokenAmount,
        uint256 maxGasLimit
    )
        internal
        view
        returns (Client.EVM2AnyMessage memory message, uint256 fee)
    {
        ChainConfig memory config = chainConfigs[chainSelector];

        require(config.isSupported, "Unsupported destination chain");

        bytes memory extraArgs = hex"";
        // Set gas limit if needed
        if (maxGasLimit > 0) {
            extraArgs = Client._argsToBytes(
                // Set gas limit
                Client.EVMExtraArgsV1({ gasLimit: maxGasLimit })
            );
        }

        // Tokens to transfer
        Client.EVMTokenAmount[]
            memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: tokenAddr,
            amount: tokenAmount
        });

        // Build the message
        message = Client.EVM2AnyMessage({
            receiver: abi.encode(config.handlerAddr),
            data: data,
            tokenAmounts: tokenAmounts,
            extraArgs: extraArgs,
            feeToken: address(0)
        });

        // Estimate fee
        fee = IRouterClient(i_router).getFee(chainSelector, message);
    }

    /**
     * @dev Grant token approval for contracts that can move tokens from here
     */
    function approveAllTokens() external virtual;

    /**
     * @notice Owner function to withdraw a specific amount of a token
     * @param token token to be transferered
     * @param amount amount of the token to be transferred
     */
    function transferToken(address token, uint256 amount)
        external
        onlyGovernor
        nonReentrant
    {
        IERC20(token).safeTransfer(_governor(), amount);
    }

    // Accept ETH to pay for gas
    receive() external payable {}
}
