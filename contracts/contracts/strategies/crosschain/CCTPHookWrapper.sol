// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Governable } from "../../governance/Governable.sol";
import { ICCTPTokenMessenger, ICCTPMessageTransmitter } from "../../interfaces/cctp/ICCTP.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";

interface ICrossChainStrategy {
    function onTokenReceived(
        uint256 tokenAmount,
        uint256 feeExecuted,
        bytes memory payload
    ) external;
}

contract CCTPHookWrapper is Governable {
    using BytesHelper for bytes;

    // CCTP Message Header fields
    // Ref: https://developers.circle.com/cctp/technical-guide#message-header
    uint8 private constant VERSION_INDEX = 0;
    uint8 private constant SOURCE_DOMAIN_INDEX = 4;
    uint8 private constant SENDER_INDEX = 44;
    uint8 private constant MESSAGE_BODY_INDEX = 148;

    // Burn Message V2 fields
    uint8 private constant BURN_MESSAGE_V2_VERSION_INDEX = 0;
    uint8 private constant BURN_MESSAGE_V2_RECIPIENT_INDEX = 36;
    uint8 private constant BURN_MESSAGE_V2_AMOUNT_INDEX = 68;
    uint8 private constant BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX = 100;
    uint8 private constant BURN_MESSAGE_V2_FEE_EXECUTED_INDEX = 164;
    uint8 private constant BURN_MESSAGE_V2_HOOK_DATA_INDEX = 228;

    bytes32 private constant EMPTY_NONCE = bytes32(0);
    uint32 private constant EMPTY_FINALITY_THRESHOLD_EXECUTED = 0;

    // mapping[sourceDomainID][remoteStrategyAddress] => localStrategyAddress
    mapping(uint32 => mapping(address => address)) public peers;
    event PeerAdded(
        uint32 sourceDomainID,
        address remoteContract,
        address localContract
    );
    event PeerRemoved(
        uint32 sourceDomainID,
        address remoteContract,
        address localContract
    );

    uint32 private constant CCTP_MESSAGE_VERSION = 1;
    uint32 private constant ORIGIN_MESSAGE_VERSION = 1010;

    ICCTPMessageTransmitter public immutable cctpMessageTransmitter;
    ICCTPTokenMessenger public immutable cctpTokenMessenger;

    constructor(address _cctpMessageTransmitter, address cctpTokenMessenger) {
        cctpMessageTransmitter = ICCTPMessageTransmitter(
            _cctpMessageTransmitter
        );
        cctpTokenMessenger = ICCTPTokenMessenger(cctpTokenMessenger);
    }

    function setPeer(
        uint32 sourceDomainID,
        address remoteContract,
        address localContract
    ) external onlyGovernor {
        peers[sourceDomainID][remoteContract] = localContract;
        emit PeerAdded(sourceDomainID, remoteContract, localContract);
    }

    function removePeer(uint32 sourceDomainID, address remoteContract)
        external
        onlyGovernor
    {
        address localContract = peers[sourceDomainID][remoteContract];
        delete peers[sourceDomainID][remoteContract];
        emit PeerRemoved(sourceDomainID, remoteContract, localContract);
    }

    function relay(bytes memory message, bytes memory attestation) external {
        // Ensure message version
        uint32 version = message
            .extractSlice(VERSION_INDEX, VERSION_INDEX + 4)
            .decodeUint32();

        // Ensure that it's a CCTP message
        require(
            version == CCTP_MESSAGE_VERSION,
            "Invalid CCTP message version"
        );

        uint32 sourceDomainID = message
            .extractSlice(SOURCE_DOMAIN_INDEX, SOURCE_DOMAIN_INDEX + 4)
            .decodeUint32();

        // Grab the message sender
        address sender = abi.decode(
            message.extractSlice(SENDER_INDEX, SENDER_INDEX + 32),
            (address)
        );

        // Ensure message body version
        bytes memory messageBody = message.extractSlice(
            MESSAGE_BODY_INDEX,
            message.length
        );
        bytes memory bodyVersionSlice = messageBody.extractSlice(
            BURN_MESSAGE_V2_VERSION_INDEX,
            BURN_MESSAGE_V2_VERSION_INDEX + 4
        );
        version = bodyVersionSlice.decodeUint32();

        bool isBurnMessageV1 = sender == address(cctpTokenMessenger);

        if (isBurnMessageV1) {
            // Handle burn message
            require(
                version == 1 &&
                    messageBody.length >= BURN_MESSAGE_V2_MINT_RECIPIENT_INDEX,
                "Invalid burn message"
            );

            // Find sender
            bytes memory messageSender = messageBody.extractSlice(
                BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX,
                BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX + 32
            );
            sender = abi.decode(messageSender, (address));
        }

        address recipientContract = peers[sourceDomainID][sender];

        if (isBurnMessageV1) {
            bytes memory recipientSlice = messageBody.extractSlice(
                BURN_MESSAGE_V2_RECIPIENT_INDEX,
                BURN_MESSAGE_V2_RECIPIENT_INDEX + 32
            );
            address whitelistedRecipient = abi.decode(
                recipientSlice,
                (address)
            );
            require(
                whitelistedRecipient == recipientContract,
                "Invalid recipient"
            );
        }

        require(
            recipientContract != address(0),
            "Sender is not a configured peer"
        );

        // Relay the message
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

            ICrossChainStrategy(recipientContract).onTokenReceived(
                tokenAmount - feeExecuted,
                feeExecuted,
                hookData
            );
        }
    }
}
