// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICCTPMessageTransmitter } from "../../interfaces/cctp/ICCTP.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";
import { IMessageHandlerV2 } from "../../interfaces/cctp/ICCTP.sol";

// CCTP Message Header fields
// Ref: https://developers.circle.com/cctp/technical-guide#message-header
uint8 constant VERSION_INDEX = 0;
uint8 constant SOURCE_DOMAIN_INDEX = 4;
uint8 constant SENDER_INDEX = 44;
uint8 constant RECIPIENT_INDEX = 76;
uint8 constant MESSAGE_BODY_INDEX = 148;

/**
 * @title Mock conctract simulating the functionality of the CCTPTokenMessenger contract
 *        for the porposes of unit testing.
 * @author Origin Protocol Inc
 */

contract CCTPMessageTransmitterMock is ICCTPMessageTransmitter {
    using BytesHelper for bytes;

    IERC20 public usdc;
    uint256 public nonce = 0;

    bool public shouldRevertNextReceiveMessage;

    event MessageReceivedInMockTransmitter(bytes message);

    // Full message with header
    struct Message {
        uint32 version;
        uint32 sourceDomain;
        uint32 destinationDomain;
        bytes32 recipient;
        bytes32 sender;
        bytes32 destinationCaller;
        uint32 minFinalityThreshold;
        bool isTokenTransfer;
        uint256 tokenAmount;
        bytes messageBody;
    }

    Message[] public messages;

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    // @dev for the porposes of unit tests queues the message to be mock-sent using
    // the cctp bridge.
    function sendMessage(
        uint32 destinationDomain,
        bytes32 recipient,
        bytes32 destinationCaller,
        uint32 minFinalityThreshold,
        bytes memory messageBody
    ) external override {
        bytes32 nonceHash = keccak256(abi.encodePacked(nonce));
        nonce++;

        Message memory message = Message({
            version: 1,
            sourceDomain: 1,
            destinationDomain: destinationDomain,
            recipient: recipient,
            sender: bytes32(uint256(uint160(msg.sender))),
            destinationCaller: destinationCaller,
            minFinalityThreshold: minFinalityThreshold,
            isTokenTransfer: false,
            tokenAmount: 0,
            messageBody: messageBody
        });

        messages.push(message);
    }

    // @dev for the porposes of unit tests queues the USDC burn/mint to be executed
    // using the cctp bridge.
    function sendTokenTransferMessage(
        uint32 destinationDomain,
        bytes32 recipient,
        bytes32 destinationCaller,
        uint32 minFinalityThreshold,
        uint256 tokenAmount,
        bytes memory messageBody
    ) external {
        bytes32 nonceHash = keccak256(abi.encodePacked(nonce));
        nonce++;

        Message memory message = Message({
            version: 1,
            sourceDomain: 1,
            destinationDomain: destinationDomain,
            recipient: recipient,
            sender: bytes32(uint256(uint160(msg.sender))),
            destinationCaller: destinationCaller,
            minFinalityThreshold: minFinalityThreshold,
            isTokenTransfer: true,
            tokenAmount: tokenAmount,
            messageBody: messageBody
        });

        messages.push(message);
    }

    function receiveMessage(bytes memory message, bytes memory attestation)
        public
        override
        returns (bool)
    {
        // For mock, assume we can decode and push, but simplified: just push the bytes as body or something
        // To properly decode, we'd need the header parsing logic
        // For now, emit or log, but to store, perhaps add a function later

        uint32 sourceDomain = message.extractUint32(SOURCE_DOMAIN_INDEX);
        address recipient = message.extractAddress(RECIPIENT_INDEX);
        address sender = message.extractAddress(SENDER_INDEX);
        IMessageHandlerV2(recipient).handleReceiveFinalizedMessage(
            sourceDomain,
            bytes32(uint256(uint160(sender))),
            2000,
            message.extractSlice(MESSAGE_BODY_INDEX, message.length)
        );

        // This step won't mint USDC, transfer it to the recipient address
        // in your tests
        emit MessageReceivedInMockTransmitter(message);

        // // For testing purposes, we can revert the next receive message
        // if (shouldRevertNextReceiveMessage) {
        //     shouldRevertNextReceiveMessage = false;
        //     return false;
        // }

        return true;
    }

    function addMessage(Message memory msg) external {
        messages.push(msg);
    }

    function _encodeMessageHeader(
        uint32 version,
        uint32 sourceDomain,
        bytes32 sender,
        bytes32 recipient,
        bytes memory messageBody
    ) internal pure returns (bytes memory) {
        bytes memory header = abi.encodePacked(
            version, // 0-3
            sourceDomain, // 4-7
            bytes32(0), // 8-39 destinationDomain
            bytes4(0), // 40-43 nonce
            sender, // 44-75 sender
            recipient, // 76-107 recipient
            bytes32(0), // other stuff
            bytes8(0) // other stuff
        );
        return abi.encodePacked(header, messageBody);
    }

    function _removeFront() internal returns (Message memory) {
        require(messages.length > 0, "No messages");
        Message memory removed = messages[0];
        // Shift array
        for (uint256 i = 0; i < messages.length - 1; i++) {
            messages[i] = messages[i + 1];
        }
        messages.pop();
        return removed;
    }

    function _processMessage(Message memory msg) internal {
        bytes memory encoded = _encodeMessageHeader(
            msg.version,
            msg.sourceDomain,
            msg.sender,
            msg.recipient,
            msg.messageBody
        );

        receiveMessage(encoded, bytes(""));
    }

    function _removeBack() internal returns (Message memory) {
        require(messages.length > 0, "No messages");
        Message memory last = messages[messages.length - 1];
        messages.pop();
        return last;
    }

    function processFront() external {
        Message memory msg = _removeFront();
        _processMessage(msg);
    }

    function processBack() external {
        Message memory msg = _removeBack();
        _processMessage(msg);
    }

    function getMessagesLength() external view returns (uint256) {
        return messages.length;
    }

    function revertNextReceiveMessage() external {
        shouldRevertNextReceiveMessage = true;
    }
}
