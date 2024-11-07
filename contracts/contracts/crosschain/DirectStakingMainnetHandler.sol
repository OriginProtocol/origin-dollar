// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { CCIPReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";

import { IVault } from "../interfaces/IVault.sol";
import { IOUSD } from "../interfaces/IOUSD.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";

import { AbstractDirectStakingHandler } from "./AbstractDirectStakingHandler.sol";

contract DirectStakingMainnetHandler is AbstractDirectStakingHandler {
    IERC20 public immutable weth;
    IVault public immutable oethVault;
    IOUSD public immutable oeth;
    IERC4626 public immutable woeth;

    event DirectStake(
        uint64 sourceChainId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 forwardingFee,
        bytes32 nextMessageID
    );

    constructor(
        address _router,
        address _weth,
        address _oethVault,
        address _oeth,
        address _woeth
    ) AbstractDirectStakingHandler(_router) {
        weth = IERC20(_weth);
        oethVault = IVault(_oethVault);
        oeth = IOUSD(_oeth);
        woeth = IERC4626(_woeth);
    }

    function _ccipReceive(Client.Any2EVMMessage memory message)
        internal
        virtual
        override
        onlyIfNotCursed
        nonReentrant
    {
        ChainConfig memory cc = chainConfigs[message.sourceChainSelector];

        // Make sure it's from one of the supported chains
        require(cc.isSupported, "Unsupported source chain");
        require(
            abi.decode(message.sender, (address)) == cc.handlerAddr,
            "Unknown sender"
        );

        // Make sure it contains WETH from source chain
        require(message.destTokenAmounts.length == 1, "Invalid tokens sent");

        Client.EVMTokenAmount memory tokenAmount = message.destTokenAmounts[0];
        require(tokenAmount.token == address(weth), "Unsupported source token");
        require(tokenAmount.amount > 0, "No tokens sent");

        // And min expected amount in the data
        uint256 minExpectedWOETH = abi.decode(message.data, (uint256));

        // Mint OETH
        oethVault.mint(address(weth), tokenAmount.amount, tokenAmount.amount);

        // Wrap everything into wOETH
        uint256 receivedWOETH = woeth.deposit(
            oeth.balanceOf(address(this)),
            address(this)
        );

        // Ensure minAmount
        require(receivedWOETH >= minExpectedWOETH, "Slippage issue");

        // Send it back to the caller
        (
            Client.EVM2AnyMessage memory nextMessage,
            uint256 fee
        ) = _buildCCIPMessage(
                message.sourceChainSelector,
                // Encoded source message ID
                abi.encode(message.messageId),
                address(woeth),
                receivedWOETH,
                // Just a rough estimation of how much gas limit would
                // be needed to process this message back on the source chain
                400000
            );

        // Send message through CCIP
        IRouterClient router = IRouterClient(i_router);
        bytes32 nextMessageId = router.ccipSend{ value: fee }(
            message.sourceChainSelector,
            nextMessage
        );

        emit DirectStake(
            message.sourceChainSelector,
            address(weth),
            address(woeth),
            tokenAmount.amount,
            receivedWOETH,
            fee,
            nextMessageId
        );
    }

    function approveAllTokens() external override onlyGovernor {
        // Allow Vault to move WETH from here
        weth.approve(address(oethVault), type(uint256).max);

        // Allow wOETH to move OETH from here
        oeth.approve(address(woeth), type(uint256).max);

        // Allow CCIP Router to move wOETH from here
        woeth.approve(i_router, type(uint256).max);
    }
}
