// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICCTPTokenMessenger, ICCTPMessageTransmitter } from "../../interfaces/cctp/ICCTP.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";

abstract contract AbstractCCTPMessageRelayer {
    using BytesHelper for bytes;

    // CCTP Message Header fields
    // Ref: https://developers.circle.com/cctp/technical-guide#message-header
    uint8 private constant VERSION_INDEX = 0;
    uint8 private constant SOURCE_DOMAIN_INDEX = 4;
    uint8 private constant SENDER_INDEX = 44;
    uint8 private constant RECIPIENT_INDEX = 76;
    uint8 private constant MESSAGE_BODY_INDEX = 148;

    // Message body V2 fields
    // Ref: https://developers.circle.com/cctp/technical-guide#message-body
    // Ref: https://github.com/circlefin/evm-cctp-contracts/blob/master/src/messages/v2/BurnMessageV2.sol
    uint8 private constant BURN_MESSAGE_V2_VERSION_INDEX = 0;
    uint8 private constant BURN_MESSAGE_V2_RECIPIENT_INDEX = 36;
    uint8 private constant BURN_MESSAGE_V2_AMOUNT_INDEX = 68;
    uint8 private constant BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX = 100;
    uint8 private constant BURN_MESSAGE_V2_FEE_EXECUTED_INDEX = 164;
    uint8 private constant BURN_MESSAGE_V2_HOOK_DATA_INDEX = 228;

    uint32 public constant CCTP_MESSAGE_VERSION = 1;
    uint32 public constant ORIGIN_MESSAGE_VERSION = 1010;

    // CCTP contracts
    // This implementation assumes that remote and local chains have these contracts
    // deployed on the same addresses.
    ICCTPMessageTransmitter public immutable cctpMessageTransmitter;
    ICCTPTokenMessenger public immutable cctpTokenMessenger;

    // Domain ID of the chain from which messages are accepted
    uint32 public immutable peerDomainID;

    constructor(
        address _cctpMessageTransmitter,
        address _cctpTokenMessenger,
        uint32 _peerDomainID
    ) {
        cctpMessageTransmitter = ICCTPMessageTransmitter(
            _cctpMessageTransmitter
        );
        cctpTokenMessenger = ICCTPTokenMessenger(_cctpTokenMessenger);
        peerDomainID = _peerDomainID;
    }

    function _decodeMessageHeader(bytes memory message)
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
        version = message
            .extractSlice(VERSION_INDEX, VERSION_INDEX + 4)
            .decodeUint32();
        sourceDomainID = message
            .extractSlice(SOURCE_DOMAIN_INDEX, SOURCE_DOMAIN_INDEX + 4)
            .decodeUint32();
        // Address of MessageTransmitterV2 caller on source domain
        sender = abi.decode(
            message.extractSlice(SENDER_INDEX, SENDER_INDEX + 32),
            (address)
        );
        // Address to handle message body on destination domain
        recipient = abi.decode(
            message.extractSlice(RECIPIENT_INDEX, RECIPIENT_INDEX + 32),
            (address)
        );
        messageBody = message.extractSlice(MESSAGE_BODY_INDEX, message.length);
    }

    function relay(bytes memory message, bytes memory attestation) external {
        (
            uint32 version,
            uint32 sourceDomainID,
            address sender,
            address recipient,
            bytes memory messageBody
        ) = _decodeMessageHeader(message);

        // Ensure that it's a CCTP message
        require(
            version == CCTP_MESSAGE_VERSION,
            "Invalid CCTP message version"
        );

        // Ensure that the source domain is the peer domain
        require(sourceDomainID == peerDomainID, "Unknown Source Domain");

        // Ensure message body version
        bytes memory bodyVersionSlice = messageBody.extractSlice(
            BURN_MESSAGE_V2_VERSION_INDEX,
            BURN_MESSAGE_V2_VERSION_INDEX + 4
        );
        version = bodyVersionSlice.decodeUint32();

        // TODO: what if the sender sends another type of a message not just the burn message?
        bool isBurnMessageV1 = sender == address(cctpTokenMessenger);

        if (isBurnMessageV1) {
            // Handle burn message
            require(
                version == 1 &&
                    messageBody.length >= BURN_MESSAGE_V2_HOOK_DATA_INDEX,
                "Invalid burn message"
            );

            // Address of caller of depositForBurn (or depositForBurnWithCaller) on source domain
            bytes memory messageSender = messageBody.extractSlice(
                BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX,
                BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX + 32
            );
            sender = abi.decode(messageSender, (address));

            bytes memory recipientSlice = messageBody.extractSlice(
                BURN_MESSAGE_V2_RECIPIENT_INDEX,
                BURN_MESSAGE_V2_RECIPIENT_INDEX + 32
            );

            recipient = abi.decode(recipientSlice, (address));
        } else {
            // We handle only Burn message or our custom messagee
            require(
                version == ORIGIN_MESSAGE_VERSION,
                "Unsupported message version"
            );
        }

        require(sender == recipient, "Sender and recipient must be the same");
        require(sender == address(this), "Incorrect sender/recipient address");

        // Relay the message
        // This step also mints USDC and transfers it to the recipient wallet
        bool relaySuccess = cctpMessageTransmitter.receiveMessage(
            message,
            attestation
        );
        require(relaySuccess, "Receive message failed");

        if (isBurnMessageV1) {
            bytes memory hookData = messageBody.extractSlice(
                BURN_MESSAGE_V2_HOOK_DATA_INDEX,
                messageBody.length
            );

            bytes memory amountSlice = messageBody.extractSlice(
                BURN_MESSAGE_V2_AMOUNT_INDEX,
                BURN_MESSAGE_V2_AMOUNT_INDEX + 32
            );
            uint256 tokenAmount = abi.decode(amountSlice, (uint256));

            bytes memory feeSlice = messageBody.extractSlice(
                BURN_MESSAGE_V2_FEE_EXECUTED_INDEX,
                BURN_MESSAGE_V2_FEE_EXECUTED_INDEX + 32
            );
            uint256 feeExecuted = abi.decode(feeSlice, (uint256));

            _onTokenReceived(tokenAmount - feeExecuted, feeExecuted, hookData);
        }
    }

    /**
     * @dev Called when the USDC is received from the CCTP
     * @param tokenAmount The actual amount of USDC received (amount sent - fee executed)
     * @param feeExecuted The fee executed
     * @param payload The payload of the message (hook data)
     */
    function _onTokenReceived(
        uint256 tokenAmount,
        uint256 feeExecuted,
        bytes memory payload
    ) internal virtual;

    /**
     * @dev Called when the message is received
     * @param payload The payload of the message
     */
    function _onMessageReceived(bytes memory payload) internal virtual;
}
