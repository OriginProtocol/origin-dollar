// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title CrossChainStrategyHelper
 * @author Origin Protocol Inc
 * @dev This library is used to encode and decode the messages for the cross-chain strategy.
 *      It is used to ensure that the messages are valid and to get the message version and type.
 */

import { BytesHelper } from "../../utils/BytesHelper.sol";

library CrossChainStrategyHelper {
    using BytesHelper for bytes;

    uint32 public constant DEPOSIT_MESSAGE = 1;
    uint32 public constant WITHDRAW_MESSAGE = 2;
    uint32 public constant BALANCE_CHECK_MESSAGE = 3;

    uint32 public constant CCTP_MESSAGE_VERSION = 1;
    uint32 public constant ORIGIN_MESSAGE_VERSION = 1010;

    // CCTP Message Header fields
    // Ref: https://developers.circle.com/cctp/technical-guide#message-header
    uint8 private constant VERSION_INDEX = 0;
    uint8 private constant SOURCE_DOMAIN_INDEX = 4;
    uint8 private constant SENDER_INDEX = 44;
    uint8 private constant RECIPIENT_INDEX = 76;
    uint8 private constant MESSAGE_BODY_INDEX = 148;

    /**
     * @dev Get the message version from the message.
     *      It should always be 4 bytes long,
     *      starting from the 0th index.
     * @param message The message to get the version from
     * @return The message version
     */
    function getMessageVersion(bytes memory message)
        internal
        pure
        returns (uint32)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        return message.extractUint32(0);
    }

    /**
     * @dev Get the message type from the message.
     *      It should always be 4 bytes long,
     *      starting from the 4th index.
     * @param message The message to get the type from
     * @return The message type
     */
    function getMessageType(bytes memory message)
        internal
        pure
        returns (uint32)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        return message.extractUint32(4);
    }

    /**
     * @dev Verify the message version and type.
     *      The message version should be the same as the Origin message version,
     *      and the message type should be the same as the expected message type.
     * @param _message The message to verify
     * @param _type The expected message type
     */
    function verifyMessageVersionAndType(bytes memory _message, uint32 _type)
        internal
        pure
    {
        require(
            getMessageVersion(_message) == ORIGIN_MESSAGE_VERSION,
            "Invalid Origin Message Version"
        );
        require(getMessageType(_message) == _type, "Invalid Message type");
    }

    /**
     * @dev Get the message payload from the message.
     *      The payload starts at the 8th byte.
     * @param message The message to get the payload from
     * @return The message payload
     */
    function getMessagePayload(bytes memory message)
        internal
        pure
        returns (bytes memory)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        // Payload starts at byte 8
        return message.extractSlice(8, message.length);
    }

    /**
     * @dev Encode the deposit message.
     *      The message version and type are always encoded in the message.
     * @param nonce The nonce of the deposit
     * @param depositAmount The amount of the deposit
     * @return The encoded deposit message
     */
    function encodeDepositMessage(uint64 nonce, uint256 depositAmount)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                ORIGIN_MESSAGE_VERSION,
                DEPOSIT_MESSAGE,
                abi.encode(nonce, depositAmount)
            );
    }

    /**
     * @dev Decode the deposit message.
     *      The message version and type are verified in the message.
     * @param message The message to decode
     * @return The nonce and the amount of the deposit
     */
    function decodeDepositMessage(bytes memory message)
        internal
        pure
        returns (uint64, uint256)
    {
        verifyMessageVersionAndType(message, DEPOSIT_MESSAGE);

        (uint64 nonce, uint256 depositAmount) = abi.decode(
            getMessagePayload(message),
            (uint64, uint256)
        );
        return (nonce, depositAmount);
    }

    /**
     * @dev Encode the withdrawal message.
     *      The message version and type are always encoded in the message.
     * @param nonce The nonce of the withdrawal
     * @param withdrawAmount The amount of the withdrawal
     * @return The encoded withdrawal message
     */
    function encodeWithdrawMessage(uint64 nonce, uint256 withdrawAmount)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                ORIGIN_MESSAGE_VERSION,
                WITHDRAW_MESSAGE,
                abi.encode(nonce, withdrawAmount)
            );
    }

    /**
     * @dev Decode the withdrawal message.
     *      The message version and type are verified in the message.
     * @param message The message to decode
     * @return The nonce and the amount of the withdrawal
     */
    function decodeWithdrawMessage(bytes memory message)
        internal
        pure
        returns (uint64, uint256)
    {
        verifyMessageVersionAndType(message, WITHDRAW_MESSAGE);

        (uint64 nonce, uint256 withdrawAmount) = abi.decode(
            getMessagePayload(message),
            (uint64, uint256)
        );
        return (nonce, withdrawAmount);
    }

    /**
     * @dev Encode the balance check message.
     *      The message version and type are always encoded in the message.
     * @param nonce The nonce of the balance check
     * @param balance The balance to check
     * @param transferConfirmation Indicates if the message is a transfer confirmation. This is true
     *                            when the message is a result of a deposit or a withdrawal.
     * @return The encoded balance check message
     */
    function encodeBalanceCheckMessage(
        uint64 nonce,
        uint256 balance,
        bool transferConfirmation
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                ORIGIN_MESSAGE_VERSION,
                BALANCE_CHECK_MESSAGE,
                abi.encode(nonce, balance, transferConfirmation)
            );
    }

    /**
     * @dev Decode the balance check message.
     *      The message version and type are verified in the message.
     * @param message The message to decode
     * @return The nonce, the balance and indicates if the message is a transfer confirmation
     */
    function decodeBalanceCheckMessage(bytes memory message)
        internal
        pure
        returns (
            uint64,
            uint256,
            bool
        )
    {
        verifyMessageVersionAndType(message, BALANCE_CHECK_MESSAGE);

        (uint64 nonce, uint256 balance, bool transferConfirmation) = abi.decode(
            getMessagePayload(message),
            (uint64, uint256, bool)
        );
        return (nonce, balance, transferConfirmation);
    }

    /**
     * @dev Decode the CCTP message header
     * @param message Message to decode
     * @return version Version of the message
     * @return sourceDomainID Source domain ID
     * @return sender Sender of the message
     * @return recipient Recipient of the message
     * @return messageBody Message body
     */
    function decodeMessageHeader(bytes memory message)
        internal
        pure
        returns (
            uint32 version,
            uint32 sourceDomainID,
            address sender,
            address recipient,
            bytes memory messageBody
        )
    {
        version = message.extractUint32(VERSION_INDEX);
        sourceDomainID = message.extractUint32(SOURCE_DOMAIN_INDEX);
        // Address of MessageTransmitterV2 caller on source domain
        sender = message.extractAddress(SENDER_INDEX);
        // Address to handle message body on destination domain
        recipient = message.extractAddress(RECIPIENT_INDEX);
        messageBody = message.extractSlice(MESSAGE_BODY_INDEX, message.length);
    }
}
