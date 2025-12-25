// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IMessageHandlerV2 } from "../../interfaces/cctp/ICCTP.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";
import { CCTPMessageTransmitterMock } from "./CCTPMessageTransmitterMock.sol";

uint8 constant SOURCE_DOMAIN_INDEX = 4;
uint8 constant RECIPIENT_INDEX = 76;
uint8 constant SENDER_INDEX = 44;
uint8 constant MESSAGE_BODY_INDEX = 148;

/**
 * @title Mock conctract simulating the functionality of the CCTPTokenMessenger contract
 *        for the porposes of unit testing.
 * @author Origin Protocol Inc
 */

contract CCTPMessageTransmitterMock2 is CCTPMessageTransmitterMock {
    using BytesHelper for bytes;

    address public cctpTokenMessenger;

    event MessageReceivedInMockTransmitter(bytes message);
    event MessageSent(bytes message);

    constructor(address _usdc) CCTPMessageTransmitterMock(_usdc) {}

    function setCCTPTokenMessenger(address _cctpTokenMessenger) external {
        cctpTokenMessenger = _cctpTokenMessenger;
    }

    function sendMessage(
        uint32 destinationDomain,
        bytes32 recipient,
        bytes32 destinationCaller,
        uint32 minFinalityThreshold,
        bytes memory messageBody
    ) external virtual override {
        bytes memory message = abi.encodePacked(
            uint32(1), // version
            uint32(destinationDomain == 0 ? 6 : 0), // source domain
            uint32(destinationDomain), // destination domain
            uint256(0),
            bytes32(uint256(uint160(msg.sender))), // sender
            recipient, // recipient
            destinationCaller, // destination caller
            minFinalityThreshold, // min finality threshold
            uint32(0),
            messageBody // message body
        );
        emit MessageSent(message);
    }

    function receiveMessage(bytes memory message, bytes memory attestation)
        public
        virtual
        override
        returns (bool)
    {
        uint32 sourceDomain = message.extractUint32(SOURCE_DOMAIN_INDEX);
        address recipient = message.extractAddress(RECIPIENT_INDEX);
        address sender = message.extractAddress(SENDER_INDEX);

        bytes memory messageBody = message.extractSlice(
            MESSAGE_BODY_INDEX,
            message.length
        );

        bool isBurnMessage = recipient == cctpTokenMessenger;

        if (isBurnMessage) {
            // recipient = messageBody.extractAddress(BURN_MESSAGE_V2_RECIPIENT_INDEX);
            // This step won't mint USDC, transfer it to the recipient address
            // in your tests
        } else {
            IMessageHandlerV2(recipient).handleReceiveFinalizedMessage(
                sourceDomain,
                bytes32(uint256(uint160(sender))),
                2000,
                messageBody
            );
        }

        // This step won't mint USDC, transfer it to the recipient address
        // in your tests
        emit MessageReceivedInMockTransmitter(message);

        return true;
    }
}
