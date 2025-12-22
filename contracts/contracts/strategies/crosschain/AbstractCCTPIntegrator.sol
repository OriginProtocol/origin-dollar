// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";

import { ICCTPTokenMessenger, ICCTPMessageTransmitter, IMessageHandlerV2 } from "../../interfaces/cctp/ICCTP.sol";

import { CrossChainStrategyHelper } from "./CrossChainStrategyHelper.sol";
import { Governable } from "../../governance/Governable.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";
import "../../utils/Helpers.sol";

// CCTP Message Header fields
// Ref: https://developers.circle.com/cctp/technical-guide#message-header
uint8 constant VERSION_INDEX = 0;
uint8 constant SOURCE_DOMAIN_INDEX = 4;
uint8 constant SENDER_INDEX = 44;
uint8 constant RECIPIENT_INDEX = 76;
uint8 constant MESSAGE_BODY_INDEX = 148;

// Message body V2 fields
// Ref: https://developers.circle.com/cctp/technical-guide#message-body
// Ref: https://github.com/circlefin/evm-cctp-contracts/blob/master/src/messages/v2/BurnMessageV2.sol
uint8 constant BURN_MESSAGE_V2_VERSION_INDEX = 0;
uint8 constant BURN_MESSAGE_V2_RECIPIENT_INDEX = 36;
uint8 constant BURN_MESSAGE_V2_AMOUNT_INDEX = 68;
uint8 constant BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX = 100;
uint8 constant BURN_MESSAGE_V2_FEE_EXECUTED_INDEX = 164;
uint8 constant BURN_MESSAGE_V2_HOOK_DATA_INDEX = 228;

abstract contract AbstractCCTPIntegrator is Governable, IMessageHandlerV2 {
    using SafeERC20 for IERC20;

    using BytesHelper for bytes;

    event CCTPMinFinalityThresholdSet(uint32 minFinalityThreshold);
    event CCTPFeePremiumBpsSet(uint32 feePremiumBps);
    event OperatorChanged(address operator);

    // CCTP contracts
    // This implementation assumes that remote and local chains have these contracts
    // deployed on the same addresses.
    ICCTPMessageTransmitter public immutable cctpMessageTransmitter;
    ICCTPTokenMessenger public immutable cctpTokenMessenger;

    // USDC address on local chain
    address public immutable baseToken;

    // Domain ID of the chain from which messages are accepted
    uint32 public immutable peerDomainID;

    // Strategy address on other chain
    address public immutable peerStrategy;

    // CCTP params
    uint32 public minFinalityThreshold;
    uint32 public feePremiumBps;
    // Threshold imposed by the CCTP
    uint256 public constant MAX_TRANSFER_AMOUNT = 10_000_000 * 10**6; // 10M USDC

    // Nonce of the last known deposit or withdrawal
    uint64 public lastTransferNonce;

    mapping(uint64 => bool) private nonceProcessed;

    address public operator;

    // For future use
    uint256[50] private __gap;

    modifier onlyCCTPMessageTransmitter() {
        require(
            msg.sender == address(cctpMessageTransmitter),
            "Caller is not the CCTP message transmitter"
        );
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Caller is not the Operator");
        _;
    }

    struct CCTPIntegrationConfig {
        address cctpTokenMessenger;
        address cctpMessageTransmitter;
        uint32 peerDomainID;
        address peerStrategy;
        address baseToken;
    }

    constructor(CCTPIntegrationConfig memory _config) {
        cctpMessageTransmitter = ICCTPMessageTransmitter(
            _config.cctpMessageTransmitter
        );
        cctpTokenMessenger = ICCTPTokenMessenger(_config.cctpTokenMessenger);
        peerDomainID = _config.peerDomainID;

        peerStrategy = _config.peerStrategy;
        baseToken = _config.baseToken;

        // Just a sanity check to ensure the base token is USDC
        uint256 _baseTokenDecimals = Helpers.getDecimals(_config.baseToken);
        string memory _baseTokenSymbol = Helpers.getSymbol(_config.baseToken);
        require(_baseTokenDecimals == 6, "Base token decimals must be 6");
        require(
            keccak256(abi.encodePacked(_baseTokenSymbol)) ==
                keccak256(abi.encodePacked("USDC")),
            "Base token symbol must be USDC"
        );
    }

    function _initialize(
        address _operator,
        uint32 _minFinalityThreshold,
        uint32 _feePremiumBps
    ) internal {
        _setOperator(_operator);
        _setMinFinalityThreshold(_minFinalityThreshold);
        _setFeePremiumBps(_feePremiumBps);
    }

    /***************************************
                    Settings
    ****************************************/
    function setOperator(address _operator) external onlyGovernor {
        _setOperator(_operator);
    }

    function _setOperator(address _operator) internal {
        operator = _operator;
        emit OperatorChanged(_operator);
    }

    function setMinFinalityThreshold(uint32 _minFinalityThreshold)
        external
        onlyGovernor
    {
        _setMinFinalityThreshold(_minFinalityThreshold);
    }

    function _setMinFinalityThreshold(uint32 _minFinalityThreshold) internal {
        // 1000 for fast transfer and 2000 for standard transfer
        require(
            _minFinalityThreshold == 1000 || _minFinalityThreshold == 2000,
            "Invalid threshold"
        );

        minFinalityThreshold = _minFinalityThreshold;
        emit CCTPMinFinalityThresholdSet(_minFinalityThreshold);
    }

    function setFeePremiumBps(uint32 _feePremiumBps) external onlyGovernor {
        _setFeePremiumBps(_feePremiumBps);
    }

    function _setFeePremiumBps(uint32 _feePremiumBps) internal {
        require(_feePremiumBps <= 3000, "Fee premium too high"); // 30%

        feePremiumBps = _feePremiumBps;
        emit CCTPFeePremiumBpsSet(_feePremiumBps);
    }

    /***************************************
             CCTP message handling
    ****************************************/

    function handleReceiveFinalizedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes memory messageBody
    ) external override onlyCCTPMessageTransmitter returns (bool) {
        return
            _handleReceivedMessage(
                sourceDomain,
                sender,
                finalityThresholdExecuted,
                messageBody
            );
    }

    function handleReceiveUnfinalizedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes memory messageBody
    ) external override onlyCCTPMessageTransmitter returns (bool) {
        return
            _handleReceivedMessage(
                sourceDomain,
                sender,
                finalityThresholdExecuted,
                messageBody
            );
    }

    function _handleReceivedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        // solhint-disable-next-line no-unused-vars
        uint32 finalityThresholdExecuted,
        bytes memory messageBody
    ) internal returns (bool) {
        // // Make sure that the finality threshold is same on both chains
        // // TODO: Do we really need this? Also, fix this
        // require(
        //     finalityThresholdExecuted >= minFinalityThreshold,
        //     "Finality threshold too low"
        // );
        require(sourceDomain == peerDomainID, "Unknown Source Domain");

        // Extract address from bytes32 (CCTP stores addresses as right-padded bytes32)
        address senderAddress = address(uint160(uint256(sender)));
        require(senderAddress == peerStrategy, "Unknown Sender");

        _onMessageReceived(messageBody);

        return true;
    }

    function _sendTokens(uint256 tokenAmount, bytes memory hookData)
        internal
        virtual
    {
        require(tokenAmount <= MAX_TRANSFER_AMOUNT, "Token amount too high");

        IERC20(baseToken).safeApprove(address(cctpTokenMessenger), tokenAmount);

        // TODO: figure out why getMinFeeAmount is not on CCTP v2 contract
        // Ref: https://developers.circle.com/cctp/evm-smart-contracts#getminfeeamount
        // The issue is that the getMinFeeAmount is not present on v2.0 contracts, but is on
        // v2.1. We will only be using standard transfers and fee on those is 0.

        uint256 maxFee = feePremiumBps > 0
            ? (tokenAmount * feePremiumBps) / 10000
            : 0;

        cctpTokenMessenger.depositForBurnWithHook(
            tokenAmount,
            peerDomainID,
            bytes32(uint256(uint160(peerStrategy))),
            address(baseToken),
            bytes32(uint256(uint160(peerStrategy))),
            maxFee,
            minFinalityThreshold,
            hookData
        );
    }

    function _sendMessage(bytes memory message) internal virtual {
        cctpMessageTransmitter.sendMessage(
            peerDomainID,
            bytes32(uint256(uint160(peerStrategy))),
            bytes32(uint256(uint160(peerStrategy))),
            minFinalityThreshold,
            message
        );
    }

    function relay(bytes memory message, bytes memory attestation)
        external
        onlyOperator
    {
        (
            uint32 version,
            uint32 sourceDomainID,
            address sender,
            address recipient,
            bytes memory messageBody
        ) = _decodeMessageHeader(message);

        // Ensure that it's a CCTP message
        require(
            version == CrossChainStrategyHelper.CCTP_MESSAGE_VERSION,
            "Invalid CCTP message version"
        );

        // Ensure that the source domain is the peer domain
        require(sourceDomainID == peerDomainID, "Unknown Source Domain");

        // Ensure message body version
        version = messageBody.extractUint32(BURN_MESSAGE_V2_VERSION_INDEX);

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
            sender = messageBody.extractAddress(
                BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX
            );

            recipient = messageBody.extractAddress(
                BURN_MESSAGE_V2_RECIPIENT_INDEX
            );
        } else {
            // We handle only Burn message or our custom messagee
            require(
                version == CrossChainStrategyHelper.ORIGIN_MESSAGE_VERSION,
                "Unsupported message version"
            );
        }

        require(sender == recipient, "Sender and recipient must be the same");
        require(sender == peerStrategy, "Incorrect sender/recipient address");

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

            uint256 tokenAmount = messageBody.extractUint256(
                BURN_MESSAGE_V2_AMOUNT_INDEX
            );

            uint256 feeExecuted = messageBody.extractUint256(
                BURN_MESSAGE_V2_FEE_EXECUTED_INDEX
            );

            _onTokenReceived(tokenAmount - feeExecuted, feeExecuted, hookData);
        }
    }

    /***************************************
                  Message utils
    ****************************************/

    function _getMessageVersion(bytes memory message)
        internal
        virtual
        returns (uint32)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        return message.extractUint32(0);
    }

    function _getMessageType(bytes memory message)
        internal
        virtual
        returns (uint32)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        return message.extractUint32(4);
    }

    function _verifyMessageVersionAndType(
        bytes memory _message,
        uint32 _version,
        uint32 _type
    ) internal virtual {
        require(
            _getMessageVersion(_message) == _version,
            "Invalid Origin Message Version"
        );
        require(_getMessageType(_message) == _type, "Invalid Message type");
    }

    function _getMessagePayload(bytes memory message)
        internal
        virtual
        returns (bytes memory)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        // Payload starts at byte 8
        return message.extractSlice(8, message.length);
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
        version = message.extractUint32(VERSION_INDEX);
        sourceDomainID = message.extractUint32(SOURCE_DOMAIN_INDEX);
        // Address of MessageTransmitterV2 caller on source domain
        sender = message.extractAddress(SENDER_INDEX);
        // Address to handle message body on destination domain
        recipient = message.extractAddress(RECIPIENT_INDEX);
        messageBody = message.extractSlice(MESSAGE_BODY_INDEX, message.length);
    }

    /***************************************
                  Nonce Handling
    ****************************************/

    function isTransferPending() public view returns (bool) {
        uint64 nonce = lastTransferNonce;
        return nonce > 0 && !nonceProcessed[nonce];
    }

    function isNonceProcessed(uint64 nonce) public view returns (bool) {
        return nonce == 0 || nonceProcessed[nonce];
    }

    function _markNonceAsProcessed(uint64 nonce) internal {
        uint64 lastNonce = lastTransferNonce;

        // Can only mark latest nonce as processed
        require(nonce >= lastNonce, "Nonce too low");
        // Can only mark nonce as processed once
        require(!nonceProcessed[nonce], "Nonce already processed");

        nonceProcessed[nonce] = true;

        if (nonce != lastNonce) {
            // Update last known nonce
            lastTransferNonce = nonce;
        }
    }

    function _getNextNonce() internal returns (uint64) {
        uint64 nonce = lastTransferNonce;

        require(
            nonce == 0 || nonceProcessed[nonce],
            "Pending deposit or withdrawal"
        );

        nonce = nonce + 1;
        lastTransferNonce = nonce;

        return nonce;
    }

    /***************************************
             Inheritence overrides
    ****************************************/

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
