// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

import { CCIPReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";

contract MockCCIPRouter {
    uint256 public feeToReturn;
    bool public isCursed_;
    bool public forwardRequests;

    uint64 public lastChainSelector;
    Client.EVM2AnyMessage public lastMessage;

    constructor() {}

    function ccipSend(
        uint64 destinationChainSelector,
        Client.EVM2AnyMessage calldata message
    ) external payable returns (bytes32) {
        if (forwardRequests) {
            address receiver = abi.decode(message.receiver, (address));
            Client.Any2EVMMessage memory messageToForward = Client
                .Any2EVMMessage({
                    sender: message.receiver,
                    data: message.data,
                    destTokenAmounts: message.tokenAmounts,
                    sourceChainSelector: destinationChainSelector,
                    messageId: bytes32(hex"deadfeed")
                });

            CCIPReceiver(receiver).ccipReceive(messageToForward);
        } else {
            lastChainSelector = destinationChainSelector;
            lastMessage = message;
        }

        return bytes32(hex"deadfeed");
    }

    function mockSend(
        address receiver,
        uint64 destinationChainSelector,
        address sender,
        bytes calldata data,
        Client.EVMTokenAmount[] calldata tokenAmounts
    ) external payable returns (bytes32) {
        Client.Any2EVMMessage memory messageToForward = Client.Any2EVMMessage({
            sender: abi.encode(sender),
            data: data,
            destTokenAmounts: tokenAmounts,
            sourceChainSelector: destinationChainSelector,
            messageId: bytes32(hex"deadfeed")
        });

        CCIPReceiver(receiver).ccipReceive(messageToForward);

        return bytes32(hex"deadfeed");
    }

    function getFee(uint64, Client.EVM2AnyMessage calldata)
        external
        view
        returns (uint256)
    {
        return feeToReturn;
    }

    function setFee(uint256 fee) external {
        feeToReturn = fee;
    }

    function getArmProxy() external view returns (address) {
        return address(this);
    }

    function isCursed() external view returns (bool) {
        return isCursed_;
    }

    function setIsCursed(bool value) external {
        isCursed_ = value;
    }

    function setForwardRequests(bool value) external {
        forwardRequests = value;
    }
}
