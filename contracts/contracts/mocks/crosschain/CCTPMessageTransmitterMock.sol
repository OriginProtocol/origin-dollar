// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICCTPMessageTransmitter } from "../../interfaces/cctp/ICCTP.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";
import { AbstractCCTPIntegrator } from "../../strategies/crosschain/AbstractCCTPIntegrator.sol";

/**
 * @title Mock conctract simulating the functionality of the CCTPTokenMessenger contract
 *        for the porposes of unit testing.
 * @author Origin Protocol Inc
 */

contract CCTPMessageTransmitterMock is ICCTPMessageTransmitter {
    using BytesHelper for bytes;

    IERC20 public usdc;
    uint256 public nonce = 0;
    // Sender index in the burn message v2
    // Ref: https://github.com/circlefin/evm-cctp-contracts/blob/master/src/messages/v2/BurnMessageV2.sol
    uint8 constant BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX = 100;
    uint8 constant BURN_MESSAGE_V2_HOOK_DATA_INDEX = 228;

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
    // map of encoded messages to the corresponding message structs
    mapping(bytes32 => Message) public encodedMessages;

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
    ) external virtual override {
        bytes32 nonceHash = keccak256(abi.encodePacked(nonce));
        nonce++;

        // If destination is mainnet, source is base and vice versa
        uint32 sourceDomain = destinationDomain == 0 ? 6 : 0;

        Message memory message = Message({
            version: 1,
            sourceDomain: sourceDomain,
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

        // If destination is mainnet, source is base and vice versa
        uint32 sourceDomain = destinationDomain == 0 ? 6 : 0;

        Message memory message = Message({
            version: 1,
            sourceDomain: sourceDomain,
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
        virtual
        override
        returns (bool)
    {
        Message memory storedMsg = encodedMessages[keccak256(message)];
        AbstractCCTPIntegrator recipient = AbstractCCTPIntegrator(
            address(uint160(uint256(storedMsg.recipient)))
        );

        bytes32 sender = storedMsg.sender;
        bytes memory messageBody = storedMsg.messageBody;

        // Credit USDC in this step as it is done in the live cctp contracts
        if (storedMsg.isTokenTransfer) {
            usdc.transfer(address(recipient), storedMsg.tokenAmount);
            // override the sender with the one stored in the Burn message as the sender int he
            // message header is the TokenMessenger.
            sender = bytes32(
                uint256(
                    uint160(
                        storedMsg.messageBody.extractAddress(
                            BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX
                        )
                    )
                )
            );
            messageBody = storedMsg.messageBody.extractSlice(
                BURN_MESSAGE_V2_HOOK_DATA_INDEX,
                storedMsg.messageBody.length
            );
        } else {
            recipient.handleReceiveFinalizedMessage(
                storedMsg.sourceDomain,
                sender,
                2000, // finality threshold
                messageBody
            );
        }

        // TODO: should we also handle unfinalized messages: handleReceiveUnfinalizedMessage?

        return true;
    }

    function addMessage(Message memory storedMsg) external {
        messages.push(storedMsg);
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

    function _processMessage(Message memory storedMsg) internal {
        bytes memory encodedMessage = _encodeMessageHeader(
            storedMsg.version,
            storedMsg.sourceDomain,
            storedMsg.sender,
            storedMsg.recipient,
            storedMsg.messageBody
        );

        encodedMessages[keccak256(encodedMessage)] = storedMsg;

        address recipient = address(uint160(uint256(storedMsg.recipient)));

        AbstractCCTPIntegrator(recipient).relay(encodedMessage, bytes(""));
    }

    function _removeBack() internal returns (Message memory) {
        require(messages.length > 0, "No messages");
        Message memory last = messages[messages.length - 1];
        messages.pop();
        return last;
    }

    function messagesInQueue() external view returns (uint256) {
        return messages.length;
    }

    function processFront() external {
        Message memory storedMsg = _removeFront();
        _processMessage(storedMsg);
    }

    function processBack() external {
        Message memory storedMsg = _removeBack();
        _processMessage(storedMsg);
    }

    function getMessagesLength() external view returns (uint256) {
        return messages.length;
    }
}
