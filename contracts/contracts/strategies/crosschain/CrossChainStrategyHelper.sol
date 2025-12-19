// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BytesHelper } from "../../utils/BytesHelper.sol";

library CrossChainStrategyHelper {
    using BytesHelper for bytes;

    uint32 public constant DEPOSIT_MESSAGE = 1;
    uint32 public constant WITHDRAW_MESSAGE = 2;
    uint32 public constant BALANCE_CHECK_MESSAGE = 3;

    uint32 public constant CCTP_MESSAGE_VERSION = 1;
    uint32 public constant ORIGIN_MESSAGE_VERSION = 1010;

    function getMessageVersion(bytes memory message)
        internal
        view
        returns (uint32)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        return message.extractUint32(0);
    }

    function getMessageType(bytes memory message)
        internal
        view
        returns (uint32)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        return message.extractUint32(4);
    }

    function verifyMessageVersionAndType(bytes memory _message, uint32 _type)
        internal
    {
        require(
            getMessageVersion(_message) == ORIGIN_MESSAGE_VERSION,
            "Invalid Origin Message Version"
        );
        require(getMessageType(_message) == _type, "Invalid Message type");
    }

    function getMessagePayload(bytes memory message)
        internal
        view
        returns (bytes memory)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        // Payload starts at byte 8
        return message.extractSlice(8, message.length);
    }

    function encodeDepositMessage(uint64 nonce, uint256 depositAmount)
        internal
        view
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                ORIGIN_MESSAGE_VERSION,
                DEPOSIT_MESSAGE,
                abi.encode(nonce, depositAmount)
            );
    }

    function decodeDepositMessage(bytes memory message)
        internal
        returns (uint64, uint256)
    {
        verifyMessageVersionAndType(message, DEPOSIT_MESSAGE);

        (uint64 nonce, uint256 depositAmount) = abi.decode(
            getMessagePayload(message),
            (uint64, uint256)
        );
        return (nonce, depositAmount);
    }

    function encodeWithdrawMessage(uint64 nonce, uint256 withdrawAmount)
        internal
        view
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                ORIGIN_MESSAGE_VERSION,
                WITHDRAW_MESSAGE,
                abi.encode(nonce, withdrawAmount)
            );
    }

    function decodeWithdrawMessage(bytes memory message)
        internal
        returns (uint64, uint256)
    {
        verifyMessageVersionAndType(message, WITHDRAW_MESSAGE);

        (uint64 nonce, uint256 withdrawAmount) = abi.decode(
            getMessagePayload(message),
            (uint64, uint256)
        );
        return (nonce, withdrawAmount);
    }

    function encodeBalanceCheckMessage(uint64 nonce, uint256 balance)
        internal
        view
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                ORIGIN_MESSAGE_VERSION,
                BALANCE_CHECK_MESSAGE,
                abi.encode(nonce, balance)
            );
    }

    function decodeBalanceCheckMessage(bytes memory message)
        internal
        returns (uint64, uint256)
    {
        verifyMessageVersionAndType(message, BALANCE_CHECK_MESSAGE);

        (uint64 nonce, uint256 balance) = abi.decode(
            getMessagePayload(message),
            (uint64, uint256)
        );
        return (nonce, balance);
    }
}
