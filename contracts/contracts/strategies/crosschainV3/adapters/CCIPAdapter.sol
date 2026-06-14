// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
// solhint-disable-next-line max-line-length
import { IAny2EVMMessageReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IAny2EVMMessageReceiver.sol";

import { AbstractAdapter } from "./AbstractAdapter.sol";
import { CCIPMessageBuilder } from "../libraries/CCIPMessageBuilder.sol";

/**
 * @title CCIPAdapter
 * @author Origin Protocol Inc
 *
 * @notice Atomic bidirectional adapter over Chainlink CCIP. Carries token + message
 *         (`sendMessageAndTokens`) or message-only (`sendMessage`) to the configured peer.
 *         Receives inbound via `ccipReceive`, validates against the lane config (source
 *         chain, peer adapter identity), and forwards to the destination strategy
 *         (CREATE3 parity: envelope sender == destination strategy on this chain).
 *
 *         The CCIP fee is paid in native and sourced from `msg.value`; excess is NOT
 *         refunded — it stays on the adapter (recover via `transferToken`).
 */
contract CCIPAdapter is AbstractAdapter, IAny2EVMMessageReceiver, IERC165 {
    using SafeERC20 for IERC20;

    /// @notice CCIP Router on this chain.
    IRouterClient public immutable ccipRouter;

    constructor(IRouterClient _ccipRouter) {
        require(address(_ccipRouter) != address(0), "CCIP: zero router");
        ccipRouter = _ccipRouter;
    }

    modifier onlyRouter() {
        require(msg.sender == address(ccipRouter), "CCIP: not router");
        _;
    }

    // --- Outbound hooks ----------------------------------------------------

    /// @dev CCIP charges a native fee per message; LINK-mode is not supported here.
    ///      `requiresExternalPayment = true` forces the strategy to supply msg.value or
    ///      cover from its pool.
    function _quoteFee(
        bytes memory envelope,
        ChainConfig memory cfg,
        address token,
        uint256 amount
    )
        internal
        view
        override
        returns (
            uint256 fee,
            address feeToken,
            bool requiresExternalPayment
        )
    {
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            token,
            amount,
            envelope,
            address(this), // peer adapter address (CREATE3 parity)
            cfg.destGasLimit
        );
        fee = ccipRouter.getFee(cfg.chainSelector, ccipMessage);
        feeToken = address(0); // native
        requiresExternalPayment = true;
    }

    function _sendMessage(
        bytes memory envelope,
        ChainConfig memory cfg,
        uint256 fee
    ) internal override {
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            address(0),
            0,
            envelope,
            address(this),
            cfg.destGasLimit
        );
        ccipRouter.ccipSend{ value: fee }(cfg.chainSelector, ccipMessage);
    }

    function _sendMessageAndTokens(
        address token,
        uint256 amount,
        bytes memory envelope,
        ChainConfig memory cfg,
        uint256 fee
    ) internal override {
        IERC20(token).safeApprove(address(ccipRouter), amount);
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            token,
            amount,
            envelope,
            address(this),
            cfg.destGasLimit
        );
        ccipRouter.ccipSend{ value: fee }(cfg.chainSelector, ccipMessage);
    }

    // --- Inbound (IAny2EVMMessageReceiver) ---------------------------------

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId)
        external
        pure
        override
        returns (bool)
    {
        return
            interfaceId == type(IAny2EVMMessageReceiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    /// @inheritdoc IAny2EVMMessageReceiver
    function ccipReceive(Client.Any2EVMMessage calldata message)
        external
        override
        onlyRouter
    {
        // Decode the transport-level sender (the source-chain caller of router.ccipSend).
        address transportSender = abi.decode(message.sender, (address));

        (
            address envelopeSender,
            uint256 intendedAmount,
            bytes memory payload
        ) = _validateInbound(
                message.sourceChainSelector,
                transportSender,
                message.data
            );

        // Single token amount expected at most; V3 doesn't multi-bundle.
        address token = address(0);
        uint256 amount = 0;
        if (message.destTokenAmounts.length > 0) {
            token = message.destTokenAmounts[0].token;
            amount = message.destTokenAmounts[0].amount;
        }

        // CCIP delivers exactly the burned amount on the destination — no transport-side
        // token fee, so `feePaid` is 0. Sanity-check the envelope intent matches.
        require(
            intendedAmount == amount,
            "CCIP: amount mismatch with envelope"
        );
        _deliver(envelopeSender, token, amount, 0, payload);
    }
}
