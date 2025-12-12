// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Yearn V3 Remote Strategy - the L2 chain part
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";
import { Generalized4626Strategy } from "../Generalized4626Strategy.sol";
import { AbstractCCTPIntegrator } from "./AbstractCCTPIntegrator.sol";

contract CrossChainRemoteStrategy is
    AbstractCCTPIntegrator,
    Generalized4626Strategy
{
    using SafeERC20 for IERC20;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _cctpTokenMessenger,
        address _cctpMessageTransmitter,
        uint32 _destinationDomain,
        address _destinationStrategy,
        address _baseToken,
        address _cctpHookWrapper
    )
        AbstractCCTPIntegrator(
            _cctpTokenMessenger,
            _cctpMessageTransmitter,
            _destinationDomain,
            _destinationStrategy,
            _baseToken,
            _cctpHookWrapper
        )
        Generalized4626Strategy(_baseConfig, _baseToken)
    {}

    // solhint-disable-next-line no-unused-vars
    function deposit(address _asset, uint256 _amount)
        external
        virtual
        override
    {
        // TODO: implement this
        revert("Not implemented");
    }

    function depositAll() external virtual override {
        // TODO: implement this
        revert("Not implemented");
    }

    function withdraw(
        address,
        address,
        uint256
    ) external virtual override {
        // TODO: implement this
        revert("Not implemented");
    }

    function withdrawAll() external virtual override {
        // TODO: implement this
        revert("Not implemented");
    }

    function _onMessageReceived(bytes memory payload) internal override {
        uint32 messageType = _getMessageType(payload);
        if (messageType == DEPOSIT_MESSAGE) {
            // // Received when Master strategy sends tokens to the remote strategy
            // Do nothing because we receive acknowledgement with token transfer, so _onTokenReceived will handle it
            // TODO: Should _onTokenReceived always call _onMessageReceived?
            // _processDepositAckMessage(payload);
        } else if (messageType == WITHDRAW_MESSAGE) {
            // Received when Master strategy requests a withdrawal
            _processWithdrawMessage(payload);
        } else {
            revert("Unknown message type");
        }
    }

    function _processDepositMessage(
        uint256 tokenAmount,
        uint256 feeExecuted,
        bytes memory payload
    ) internal virtual {
        // solhint-disable-next-line no-unused-vars
        (uint64 nonce, uint256 depositAmount) = _decodeDepositMessage(payload);

        // Replay protection
        require(!isNonceProcessed(nonce), "Nonce already processed");
        _markNonceAsProcessed(nonce);

        // Deposit everything we got
        uint256 balance = IERC20(baseToken).balanceOf(address(this));
        _deposit(baseToken, balance);

        uint256 balanceAfter = checkBalance(baseToken);

        bytes memory message = _encodeDepositAckMessage(
            nonce,
            tokenAmount,
            feeExecuted,
            balanceAfter
        );
        _sendMessage(message);
    }

    function _processWithdrawMessage(bytes memory payload) internal virtual {
        (uint64 nonce, uint256 withdrawAmount) = _decodeWithdrawMessage(
            payload
        );

        // Replay protection
        require(!isNonceProcessed(nonce), "Nonce already processed");
        _markNonceAsProcessed(nonce);

        // Withdraw funds to the remote strategy
        _withdraw(address(this), baseToken, withdrawAmount);

        // Check balance after withdrawal
        uint256 balanceAfter = checkBalance(baseToken);

        bytes memory message = _encodeWithdrawAckMessage(
            nonce,
            withdrawAmount,
            balanceAfter
        );
        _sendTokens(withdrawAmount, message);
    }

    function _onTokenReceived(
        uint256 tokenAmount,
        uint256 feeExecuted,
        bytes memory payload
    ) internal override {
        uint32 messageType = _getMessageType(payload);

        require(messageType == DEPOSIT_MESSAGE, "Invalid message type");

        _processDepositMessage(tokenAmount, feeExecuted, payload);
    }

    function sendBalanceUpdate() external virtual {
        // TODO: Add permissioning
        uint256 balance = checkBalance(baseToken);
        bytes memory message = _encodeBalanceCheckMessage(
            lastTransferNonce,
            balance
        );
        _sendMessage(message);
    }
}
