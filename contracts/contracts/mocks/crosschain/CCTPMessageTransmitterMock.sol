// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICCTPMessageTransmitter } from "../../interfaces/cctp/ICCTP.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";

/**
 * @title Mock conctract simulating the functionality of the CCTPTokenMessenger contract
 *        for the porposes of unit testing. 
 * @author Origin Protocol Inc
 */

contract CCTPMessageTransmitterMock is ICCTPMessageTransmitter {
    IERC20 public usdc;
    uint256 public nonce = 0;

    
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

    function receiveMessage(bytes calldata message, bytes calldata attestation)
        external
        override
        returns (bool) {
        // For mock, assume we can decode and push, but simplified: just push the bytes as body or something
        // To properly decode, we'd need the header parsing logic
        // For now, emit or log, but to store, perhaps add a function later
        return true;
    }

    function addMessage(Message memory msg) external {
        messages.push(msg);
    }

    function removeFront() external returns (Message memory) {
        require(messages.length > 0, "No messages");
        Message memory removed = messages[0];
        // Shift array
        for (uint256 i = 0; i < messages.length - 1; i++) {
            messages[i] = messages[i + 1];
        }
        messages.pop();
        return removed;
    }

    function removeBack() external returns (Message memory) {
        require(messages.length > 0, "No messages");
        Message memory last = messages[messages.length - 1];
        messages.pop();
        return last;
    }

    function getMessagesLength() external view returns (uint256) {
        return messages.length;
    }
}
