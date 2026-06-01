// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IMessageHandlerV2 } from "../../../interfaces/cctp/ICCTP.sol";
import { AbstractReceiverAdapter } from "./AbstractReceiverAdapter.sol";
import { CrossChainV3Helper } from "../CrossChainV3Helper.sol";

/**
 * @title CCTPReceiverAdapter
 * @author Origin Protocol Inc
 *
 * @notice Atomic inbound adapter over Circle CCTP V2. Implements `IMessageHandlerV2`; CCTP
 *         calls into `handleReceiveFinalizedMessage` once attestation has cleared, at which
 *         point the USDC has already been minted to this adapter (the `destinationCaller`).
 *
 *         We then verify the source domain + sender match our configured peer, unwrap the
 *         envelope, transfer USDC to the strategy, and call `receiveFromBridge`.
 */
contract CCTPReceiverAdapter is AbstractReceiverAdapter, IMessageHandlerV2 {
    /// @notice USDC on this chain.
    address public immutable usdcToken;

    /// @notice CCTP MessageTransmitter that's authorised to call our handlers.
    address public immutable cctpMessageTransmitter;

    constructor(address _usdcToken, address _cctpMessageTransmitter) {
        require(_usdcToken != address(0), "CCTPRx: zero usdc");
        require(_cctpMessageTransmitter != address(0), "CCTPRx: zero mt");
        usdcToken = _usdcToken;
        cctpMessageTransmitter = _cctpMessageTransmitter;
    }

    modifier onlyCCTP() {
        require(
            msg.sender == cctpMessageTransmitter,
            "CCTPRx: not message transmitter"
        );
        _;
    }

    /// @inheritdoc IMessageHandlerV2
    function handleReceiveFinalizedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        uint32, // finalityThresholdExecuted
        bytes calldata messageBody
    ) external override onlyCCTP returns (bool) {
        _validateAndDeliver(sourceDomain, sender, messageBody);
        return true;
    }

    /// @inheritdoc IMessageHandlerV2
    function handleReceiveUnfinalizedMessage(
        uint32, // sourceDomain
        bytes32, // sender
        uint32, // finalityThresholdExecuted
        bytes calldata // messageBody
    ) external pure override returns (bool) {
        // V3 protocol requires finalised messages only.
        revert("CCTPRx: unfinalised not accepted");
    }

    function _validateAndDeliver(
        uint32 sourceDomain,
        bytes32 sender,
        bytes calldata messageBody
    ) internal {
        require(
            uint64(sourceDomain) == peerChainSelector,
            "CCTPRx: bad source domain"
        );
        require(
            sender == bytes32(uint256(uint160(peerOutbound))),
            "CCTPRx: bad sender"
        );

        (
            uint32 version,
            uint32 msgType,
            uint64 nonce,
            bytes memory payload
        ) = CrossChainV3Helper.unwrap(messageBody);
        require(
            version == CrossChainV3Helper.ORIGIN_V3_MESSAGE_VERSION,
            "CCTPRx: bad version"
        );

        // USDC has been minted to this adapter by CCTP. Use the local balance to determine the
        // delivered amount (atomic delivery, so balance reflects what arrived with this msg).
        uint256 amount = IERC20(usdcToken).balanceOf(address(this));
        _deliverAtomic(nonce, amount, uint8(msgType), payload, usdcToken);
    }
}
