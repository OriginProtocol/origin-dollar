// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { CCIPReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";

import { IVault } from "../interfaces/IVault.sol";
import { IOUSD } from "../interfaces/IOUSD.sol";
import { IDirectStakingCaller } from "../interfaces/IDirectStakingCaller.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";

import { AbstractDirectStakingHandler } from "./AbstractDirectStakingHandler.sol";

import { MAINNET_SELECTOR } from "./CCIPChainSelector.sol";

contract DirectStakingL2Handler is AbstractDirectStakingHandler {
    IERC20 public immutable weth;
    IERC4626 public immutable woeth;

    struct StakeRequest {
        address requester;
        bool processed;
        bool callback;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 amountReceived;
        uint256 createdAt;
    }
    mapping(bytes32 => StakeRequest) public stakeRequests;

    event DirectStakeRequestCreated(
        bytes32 messageId,
        uint64 destChain,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 fee
    );

    event DirectStakeRequestCompleted(bytes32 messageId, uint256 amountOut);

    constructor(
        address _router,
        address _weth,
        address _woeth
    ) AbstractDirectStakingHandler(_router) {
        weth = IERC20(_weth);
        woeth = IERC4626(_woeth);
    }

    function _ccipReceive(Client.Any2EVMMessage memory message)
        internal
        virtual
        override
        onlyIfNotCursed
        nonReentrant
    {
        // Make sure it's from mainnet
        require(
            message.sourceChainSelector == MAINNET_SELECTOR,
            "Not from mainnet"
        );

        ChainConfig memory cc = chainConfigs[MAINNET_SELECTOR];

        // Make sure mainnet is marked as supported
        require(cc.isSupported, "Mainnet not configured");
        require(
            abi.decode(message.sender, (address)) == cc.handlerAddr,
            "Unknown sender"
        );

        // Make sure it contains wOETH from mainnet
        require(
            message.destTokenAmounts.length == 1,
            "Invalid tokens received"
        );

        Client.EVMTokenAmount memory tokenAmount = message.destTokenAmounts[0];
        require(tokenAmount.token == address(woeth), "Unsupported token");
        require(tokenAmount.amount > 0, "No tokens received");

        // Decode messageId
        bytes32 originalMessageId = abi.decode(message.data, (bytes32));

        // Make sure the requests exists
        StakeRequest memory request = stakeRequests[originalMessageId];
        require(request.requester != address(0), "Unknown request message");

        // And that it wasn't processed
        require(!request.processed, "Already processed");

        // Check slippage
        require(tokenAmount.amount >= request.minAmountOut, "Slippage error");

        // Mark as processed
        stakeRequests[originalMessageId].processed = true;
        // Store amount received (would be easier to lookup/debug if needed)
        stakeRequests[originalMessageId].amountReceived = tokenAmount.amount;

        emit DirectStakeRequestCompleted(originalMessageId, tokenAmount.amount);

        // Transfer tokens to the caller
        woeth.transfer(request.requester, tokenAmount.amount);

        if (request.callback) {
            // If requester needs a callback, invoke it
            IDirectStakingCaller(request.requester)
                .onDirectStakingRequestCompletion(
                    originalMessageId,
                    tokenAmount.amount
                );
        }
    }

    function stake(
        uint256 wethAmount,
        uint256 minAmountOut,
        bool callback
    ) external payable nonReentrant returns (bytes32) {
        require(wethAmount > 0, "Invalid amount");

        ChainConfig memory cc = chainConfigs[MAINNET_SELECTOR];

        // Make sure mainnet is marked as supported
        require(cc.isSupported, "Mainnet not configured");

        // Transfer WETH in
        weth.transferFrom(msg.sender, address(this), wethAmount);

        // Build message to initiate
        (Client.EVM2AnyMessage memory message, uint256 fee) = _buildCCIPMessage(
            MAINNET_SELECTOR,
            abi.encode(minAmountOut),
            address(weth),
            wethAmount,
            // Just a rough gas estimation
            700000
        );

        bytes32 messageId = IRouterClient(i_router).ccipSend{ value: fee }(
            MAINNET_SELECTOR,
            message
        );

        emit DirectStakeRequestCreated(
            messageId,
            MAINNET_SELECTOR,
            address(weth),
            address(woeth),
            wethAmount,
            minAmountOut,
            fee
        );

        stakeRequests[messageId] = StakeRequest({
            requester: msg.sender,
            processed: false,
            callback: callback,
            amountIn: wethAmount,
            minAmountOut: minAmountOut,
            amountReceived: 0,
            createdAt: block.timestamp
        });

        return messageId;
    }

    function approveAllTokens() external override onlyGovernor {
        // Allow CCIP Router to move WETH from here
        weth.approve(i_router, type(uint256).max);
    }
}
