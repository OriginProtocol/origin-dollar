// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IBridgeAdapter } from "../../interfaces/crosschainV3/IBridgeAdapter.sol";
import { IBridgeReceiver } from "../../interfaces/crosschainV3/IBridgeReceiver.sol";

/**
 * @title MockBridgeAdapter
 * @author Origin Protocol Inc
 *
 * @notice TEST-ONLY synchronous loopback adapter for the V3 strategy pair. Plays the role
 *         of both the outbound adapter on the source side and the receiver adapter on the
 *         destination side — it calls peer.receiveMessage() in the same transaction.
 *
 *         The new design has the wire envelope owned by the adapter, but the strategy
 *         passes opaque `payload` bytes that already encode `(msgType, nonce, body)` via
 *         `CrossChainV3Helper.packPayload`. This mock simply forwards `payload` through.
 */
contract MockBridgeAdapter is IBridgeAdapter {
    using SafeERC20 for IERC20;

    /// @notice Authorised sender on the local side (the strategy we adapt for).
    address public sender;
    /// @notice Peer receiver on the destination side (the other strategy).
    address public peer;

    /// @notice When false, send* are no-ops on the peer side. Useful for simulating
    ///         in-flight delays in tests; calls still consume tokens.
    bool public deliveryEnabled = true;

    // Inspection slots
    bytes public lastMessageSent;
    uint256 public lastAmountSent;
    address public lastTokenSent;

    event PeerConfigured(address peer);
    event SenderConfigured(address sender);
    event DeliveryToggled(bool enabled);
    event MessageDelivered(address token, uint256 amount, bytes payload);

    function setPeer(address _peer) external {
        peer = _peer;
        emit PeerConfigured(_peer);
    }

    function setSender(address _sender) external {
        sender = _sender;
        emit SenderConfigured(_sender);
    }

    function setDeliveryEnabled(bool _enabled) external {
        deliveryEnabled = _enabled;
        emit DeliveryToggled(_enabled);
    }

    /// @inheritdoc IBridgeAdapter
    function sendMessage(bytes calldata payload) external payable override {
        _requireAuthorised();
        lastMessageSent = payload;
        lastAmountSent = 0;
        lastTokenSent = address(0);

        if (!deliveryEnabled || peer == address(0)) {
            return;
        }
        _dispatch(address(0), 0, payload);
    }

    /// @inheritdoc IBridgeAdapter
    function sendMessageAndTokens(
        address token,
        uint256 amount,
        bytes calldata payload
    ) external payable override {
        _requireAuthorised();
        lastMessageSent = payload;
        lastAmountSent = amount;
        lastTokenSent = token;

        // Pull tokens from the local strategy.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        if (!deliveryEnabled || peer == address(0)) {
            return;
        }
        // Optional simulated underdelivery: consume `underdeliveryForNext` of `amount`
        // before forwarding. Lets tests assert claim-ack behaviour when CCTP fast-finality
        // (or similar protocol-side fees) reduces delivered amount below `ackAmount`.
        uint256 deliver = amount;
        if (underdeliveryForNext > 0 && underdeliveryForNext <= amount) {
            deliver = amount - underdeliveryForNext;
            underdeliveryForNext = 0;
        }
        // Forward tokens to peer and call its receiver hook synchronously.
        IERC20(token).safeTransfer(peer, deliver);
        _dispatch(token, deliver, payload);
    }

    /// @inheritdoc IBridgeAdapter
    function quoteFee(
        address,
        uint256,
        bytes calldata
    )
        external
        pure
        override
        returns (
            uint256 fee,
            address feeToken,
            bool requiresExternalPayment
        )
    {
        // Test mock: zero fee, no external payment required. Lets unit tests exercise
        // `_send` for both the user-funded path (fee=0, msg.value>=0 trivially) and the
        // pool-funded path (fee=0, balance>=0 trivially) without ETH plumbing in fixtures.
        return (0, address(0), false);
    }

    /// @notice Configurable per-tx cap for testing Master's clamp paths. Default
    ///         `type(uint256).max` means "no clamp" so existing tests stay unaffected.
    uint256 public maxTransferOverride = type(uint256).max;

    function setMaxTransferAmountOverride(uint256 _amount) external {
        maxTransferOverride = _amount;
    }

    /// @notice One-shot simulated under-delivery for the next `sendMessageAndTokens`.
    ///         Resets to 0 after consumption. Used to exercise the `amount < ackAmount`
    ///         path on the receiving strategy (CCTP fast-finality fee scenario).
    uint256 public underdeliveryForNext;

    function setUnderdeliveryForNextMessage(uint256 _amount) external {
        underdeliveryForNext = _amount;
    }

    /// @inheritdoc IBridgeAdapter
    function maxTransferAmount() external view override returns (uint256) {
        return maxTransferOverride;
    }

    /**
     * @dev Manually flush a previously-stored undelivered message to the peer.
     *      Useful in tests that toggled deliveryEnabled off to inspect in-flight state.
     */
    function flushPendingDelivery() external {
        require(deliveryEnabled, "Delivery still disabled");
        require(lastMessageSent.length > 0, "Nothing to flush");

        if (lastAmountSent > 0 && lastTokenSent != address(0)) {
            IERC20(lastTokenSent).safeTransfer(peer, lastAmountSent);
        }
        _dispatch(lastTokenSent, lastAmountSent, lastMessageSent);

        delete lastMessageSent;
        lastAmountSent = 0;
        lastTokenSent = address(0);
    }

    function _requireAuthorised() internal view {
        require(
            sender == address(0) || msg.sender == sender,
            "MockBridgeAdapter: unauthorised sender"
        );
    }

    function _dispatch(
        address token,
        uint256 amount,
        bytes memory payload
    ) internal {
        emit MessageDelivered(token, amount, payload);
        IBridgeReceiver(peer).receiveMessage(sender, token, amount, 0, payload);
    }
}
