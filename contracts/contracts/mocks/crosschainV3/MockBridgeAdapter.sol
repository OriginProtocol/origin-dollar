// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IOutboundAdapter } from "../../interfaces/crosschainV3/IOutboundAdapter.sol";
import { IBridgeReceiver } from "../../interfaces/crosschainV3/IBridgeReceiver.sol";
import { CrossChainV3Helper } from "../../strategies/crosschainV3/CrossChainV3Helper.sol";

/**
 * @title MockBridgeAdapter
 * @author Origin Protocol Inc
 *
 * @notice TEST-ONLY synchronous loopback adapter for the V3 strategy pair. Plays the role of
 *         both the outbound adapter on the source side and the receiver adapter on the
 *         destination side — it calls peer.receiveFromBridge() in the same transaction.
 *
 *         Used by the Master+Remote unit tests to wire two strategy instances in-process
 *         without spinning up real bridges.
 */
contract MockBridgeAdapter is IOutboundAdapter {
    using SafeERC20 for IERC20;

    /// @notice Authorised sender on the local side (the strategy we adapt for).
    address public sender;
    /// @notice Peer receiver on the destination side (the other strategy).
    address public peer;

    /// @notice When false, sendTokensAndMessage / sendMessage are no-ops on the peer side.
    ///         Useful for simulating in-flight delays in tests; calls still consume tokens.
    bool public deliveryEnabled = true;

    // Inspection slots
    bytes public lastMessageSent;
    uint256 public lastAmountSent;
    address public lastTokenSent;

    event PeerConfigured(address peer);
    event SenderConfigured(address sender);
    event DeliveryToggled(bool enabled);
    event MessageDelivered(uint8 messageType, uint64 nonce, uint256 amount);

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

    /// @inheritdoc IOutboundAdapter
    function sendTokensAndMessage(
        address token,
        uint256 amount,
        bytes calldata message
    ) external payable override {
        _requireAuthorised();
        lastMessageSent = message;
        lastAmountSent = amount;
        lastTokenSent = token;

        // Pull tokens from the local strategy.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        if (!deliveryEnabled || peer == address(0)) {
            return;
        }

        // Forward tokens to peer and call its receiver hook synchronously.
        IERC20(token).safeTransfer(peer, amount);
        _dispatch(amount, message);
    }

    /// @inheritdoc IOutboundAdapter
    function sendMessage(bytes calldata message) external payable override {
        _requireAuthorised();
        lastMessageSent = message;
        lastAmountSent = 0;
        lastTokenSent = address(0);

        if (!deliveryEnabled || peer == address(0)) {
            return;
        }

        _dispatch(0, message);
    }

    /// @inheritdoc IOutboundAdapter
    function estimateFee(uint256, bytes calldata)
        external
        pure
        override
        returns (uint256, uint256)
    {
        return (0, 0);
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
        _dispatch(lastAmountSent, lastMessageSent);

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

    function _dispatch(uint256 amount, bytes memory message) internal {
        (uint32 version, uint32 msgType, uint64 nonce, , ) = CrossChainV3Helper
            .unwrap(message);
        require(
            version == CrossChainV3Helper.ORIGIN_V3_MESSAGE_VERSION,
            "MockBridgeAdapter: bad version"
        );

        bytes memory payload = CrossChainV3Helper.getPayload(message);
        emit MessageDelivered(uint8(msgType), nonce, amount);

        IBridgeReceiver(peer).receiveFromBridge(
            nonce,
            amount,
            uint8(msgType),
            payload
        );
    }
}
