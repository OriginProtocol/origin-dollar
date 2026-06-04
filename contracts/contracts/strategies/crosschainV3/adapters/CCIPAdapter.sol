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
import { CrossChainV3Helper } from "../CrossChainV3Helper.sol";
import { CCIPMessageBuilder } from "../libraries/CCIPMessageBuilder.sol";
import { NativeFeeHelper } from "../libraries/NativeFeeHelper.sol";

/**
 * @title CCIPAdapter
 * @author Origin Protocol Inc
 *
 * @notice Atomic bidirectional adapter over Chainlink CCIP. Carries token + message
 *         (`sendTokensAndMessage`) or message-only (`sendMessage`) to the configured peer
 *         on a destination chain. The same contract receives inbound deliveries via
 *         `ccipReceive`, decodes the V3 envelope, and forwards to the destination strategy
 *         (CreateX parity: envelope sender == destination strategy on this chain).
 *
 *         Pays the bridge fee in native gas, with a dual source path (pre-funded balance
 *         when `msg.value == 0`, or caller-supplied with refund of surplus).
 */
contract CCIPAdapter is AbstractAdapter, IAny2EVMMessageReceiver, IERC165 {
    using SafeERC20 for IERC20;

    /// @notice CCIP Router on this chain.
    IRouterClient public immutable ccipRouter;

    /// @notice Per-sender CCIP destination gas limit for the receive callback.
    mapping(address => uint256) public destGasLimitFor;

    event DestGasLimitConfigured(address sender, uint256 destGasLimit);

    constructor(IRouterClient _ccipRouter) {
        require(address(_ccipRouter) != address(0), "CCIP: zero router");
        ccipRouter = _ccipRouter;
    }

    modifier onlyRouter() {
        require(msg.sender == address(ccipRouter), "CCIP: not router");
        _;
    }

    function setDestGasLimit(address _sender, uint256 _gasLimit)
        external
        onlyGovernor
    {
        require(authorised[_sender], "CCIP: sender not authorised");
        destGasLimitFor[_sender] = _gasLimit;
        emit DestGasLimitConfigured(_sender, _gasLimit);
    }

    // --- IOutboundAdapter ---------------------------------------------------

    function estimateFee(uint256 amount, bytes calldata message)
        external
        view
        override
        returns (uint256 nativeFee, uint256 tokenFee)
    {
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            address(0),
            amount,
            message,
            peerReceiverFor[msg.sender],
            destGasLimitFor[msg.sender]
        );
        nativeFee = ccipRouter.getFee(destinationFor[msg.sender], ccipMessage);
        tokenFee = 0;
    }

    function _sendTokensAndMessage(
        address token,
        uint256 amount,
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal override {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).safeApprove(address(ccipRouter), amount);
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            token,
            amount,
            message,
            peerReceiver,
            destGasLimitFor[msg.sender]
        );
        uint256 fee = ccipRouter.getFee(destination, ccipMessage);
        NativeFeeHelper.consume(fee);
        ccipRouter.ccipSend{ value: fee }(destination, ccipMessage);
    }

    function _sendMessage(
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal override {
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            address(0),
            0,
            message,
            peerReceiver,
            destGasLimitFor[msg.sender]
        );
        uint256 fee = ccipRouter.getFee(destination, ccipMessage);
        NativeFeeHelper.consume(fee);
        ccipRouter.ccipSend{ value: fee }(destination, ccipMessage);
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
        (
            uint32 msgType,
            uint64 nonce,
            address envelopeSender,
            bytes memory payload
        ) = _unwrapAndValidate(message.data);

        // Single-token transfers expected for V3.
        uint256 amount = 0;
        address token = address(0);
        if (message.destTokenAmounts.length > 0) {
            token = message.destTokenAmounts[0].token;
            amount = message.destTokenAmounts[0].amount;
        }

        // CREATE2 parity: destination strategy on this chain == envelope sender.
        _deliverAtomic(
            envelopeSender,
            nonce,
            amount,
            uint8(msgType),
            payload,
            token
        );
    }
}
