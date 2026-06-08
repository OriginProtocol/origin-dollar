// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICCTPMessageTransmitter, IMessageHandlerV2 } from "../../interfaces/cctp/ICCTP.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";

/**
 * @title MockCCTPRelayTransmitter
 * @author Origin Protocol Inc
 *
 * @notice TEST-ONLY minimal mock of `ICCTPMessageTransmitter` focused on the relay path.
 *         Implements just enough of `receiveMessage` to decode the CCTP V2 transport header
 *         and call back into the recipient adapter's `handleReceiveFinalizedMessage`. Has a
 *         toggle to make `receiveMessage` return `false` for failure-propagation tests.
 */
contract MockCCTPRelayTransmitter is ICCTPMessageTransmitter {
    using BytesHelper for bytes;

    uint256 private constant SOURCE_DOMAIN_INDEX = 4;
    uint256 private constant SENDER_INDEX = 44;
    uint256 private constant RECIPIENT_INDEX = 76;
    uint256 private constant MESSAGE_BODY_INDEX = 148;

    /// @notice When `false`, `receiveMessage` returns `false` without forwarding.
    bool public shouldSucceed = true;

    /// @notice Spy on the last `sendMessage` call (outbound side, not tested here).
    bytes public lastSentMessage;

    event MessageForwarded(
        address indexed recipient,
        uint32 sourceDomain,
        address sender
    );

    function setShouldSucceed(bool _ok) external {
        shouldSucceed = _ok;
    }

    function sendMessage(
        uint32, // destinationDomain
        bytes32, // recipient
        bytes32, // destinationCaller
        uint32, // minFinalityThreshold
        bytes memory messageBody
    ) external override {
        lastSentMessage = messageBody;
    }

    function receiveMessage(
        bytes calldata message,
        bytes calldata /* attestation */
    ) external override returns (bool) {
        if (!shouldSucceed) {
            return false;
        }

        uint32 sourceDomain = message.extractUint32(SOURCE_DOMAIN_INDEX);
        address sender = message.extractAddress(SENDER_INDEX);
        address recipient = message.extractAddress(RECIPIENT_INDEX);
        bytes memory body = message.extractSlice(
            MESSAGE_BODY_INDEX,
            message.length
        );

        IMessageHandlerV2(recipient).handleReceiveFinalizedMessage(
            sourceDomain,
            bytes32(uint256(uint160(sender))),
            2000,
            body
        );
        emit MessageForwarded(recipient, sourceDomain, sender);
        return true;
    }
}
