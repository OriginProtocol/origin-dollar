// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title AbstractCCTP4626Strategy - Abstract contract for CCTP morpho strategy
 * @author Origin Protocol Inc
 */

import { AbstractCCTPIntegrator } from "./AbstractCCTPIntegrator.sol";

abstract contract AbstractCCTP4626Strategy is AbstractCCTPIntegrator {
    uint32 public constant DEPOSIT_MESSAGE = 1;
    uint32 public constant WITHDRAW_MESSAGE = 2;
    uint32 public constant BALANCE_CHECK_MESSAGE = 3;

    constructor(CCTPIntegrationConfig memory _config)
        AbstractCCTPIntegrator(_config)
    {}

    function _encodeDepositMessage(uint64 nonce, uint256 depositAmount)
        internal
        virtual
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                ORIGIN_MESSAGE_VERSION,
                DEPOSIT_MESSAGE,
                abi.encode(nonce, depositAmount)
            );
    }

    function _decodeDepositMessage(bytes memory message)
        internal
        virtual
        returns (uint64, uint256)
    {
        _verifyMessageVersionAndType(
            message,
            ORIGIN_MESSAGE_VERSION,
            DEPOSIT_MESSAGE
        );

        (uint64 nonce, uint256 depositAmount) = abi.decode(
            _getMessagePayload(message),
            (uint64, uint256)
        );
        return (nonce, depositAmount);
    }

    function _encodeWithdrawMessage(uint64 nonce, uint256 withdrawAmount)
        internal
        virtual
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                ORIGIN_MESSAGE_VERSION,
                WITHDRAW_MESSAGE,
                abi.encode(nonce, withdrawAmount)
            );
    }

    function _decodeWithdrawMessage(bytes memory message)
        internal
        virtual
        returns (uint64, uint256)
    {
        _verifyMessageVersionAndType(
            message,
            ORIGIN_MESSAGE_VERSION,
            WITHDRAW_MESSAGE
        );

        (uint64 nonce, uint256 withdrawAmount) = abi.decode(
            _getMessagePayload(message),
            (uint64, uint256)
        );
        return (nonce, withdrawAmount);
    }

    function _encodeBalanceCheckMessage(uint64 nonce, uint256 balance)
        internal
        virtual
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                ORIGIN_MESSAGE_VERSION,
                BALANCE_CHECK_MESSAGE,
                abi.encode(nonce, balance)
            );
    }

    function _decodeBalanceCheckMessage(bytes memory message)
        internal
        virtual
        returns (uint64, uint256)
    {
        _verifyMessageVersionAndType(
            message,
            ORIGIN_MESSAGE_VERSION,
            BALANCE_CHECK_MESSAGE
        );

        (uint64 nonce, uint256 balance) = abi.decode(
            _getMessagePayload(message),
            (uint64, uint256)
        );
        return (nonce, balance);
    }
}
