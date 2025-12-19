// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";

import { ICCTPTokenMessenger, ICCTPMessageTransmitter, IMessageHandlerV2 } from "../../interfaces/cctp/ICCTP.sol";

import { Governable } from "../../governance/Governable.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";
import { AbstractCCTPMessageRelayer } from "./AbstractCCTPMessageRelayer.sol";
import "../../utils/Helpers.sol";

abstract contract AbstractCCTPIntegrator is
    Governable,
    IMessageHandlerV2,
    AbstractCCTPMessageRelayer
{
    using SafeERC20 for IERC20;

    using BytesHelper for bytes;

    event CCTPMinFinalityThresholdSet(uint32 minFinalityThreshold);
    event CCTPFeePremiumBpsSet(uint32 feePremiumBps);

    // USDC address on local chain
    address public immutable baseToken;

    // Strategy address on destination chain
    address public immutable destinationStrategy;

    // CCTP params
    uint32 public minFinalityThreshold;
    uint32 public feePremiumBps;
    // Threshold imposed by the CCTP
    uint256 public constant MAX_TRANSFER_AMOUNT = 10_000_000 * 10**6; // 10M USDC

    // Nonce of the last known deposit or withdrawal
    uint64 public lastTransferNonce;

    mapping(uint64 => bool) private nonceProcessed;

    // For future use
    uint256[50] private __gap;

    modifier onlyCCTPMessageTransmitter() {
        require(
            msg.sender == address(cctpMessageTransmitter),
            "Caller is not the CCTP message transmitter"
        );
        _;
    }

    struct CCTPIntegrationConfig {
        address cctpTokenMessenger;
        address cctpMessageTransmitter;
        uint32 peerDomainID;
        address destinationStrategy;
        address baseToken;
    }

    constructor(CCTPIntegrationConfig memory _config)
        AbstractCCTPMessageRelayer(
            _config.cctpMessageTransmitter,
            _config.cctpTokenMessenger,
            _config.peerDomainID
        )
    {
        destinationStrategy = _config.destinationStrategy;
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

    function _initialize(uint32 _minFinalityThreshold, uint32 _feePremiumBps)
        internal
    {
        _setMinFinalityThreshold(_minFinalityThreshold);
        _setFeePremiumBps(_feePremiumBps);
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
        require(senderAddress == destinationStrategy, "Unknown Sender");

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
            bytes32(uint256(uint160(destinationStrategy))),
            address(baseToken),
            bytes32(uint256(uint160(destinationStrategy))),
            maxFee,
            minFinalityThreshold,
            hookData
        );
    }

    function _getMessageVersion(bytes memory message)
        internal
        virtual
        returns (uint32)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        return message.extractSlice(0, 4).decodeUint32();
    }

    function _getMessageType(bytes memory message)
        internal
        virtual
        returns (uint32)
    {
        // uint32 bytes 0 to 4 is Origin message version
        // uint32 bytes 4 to 8 is Message type
        return message.extractSlice(4, 8).decodeUint32();
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

    function _sendMessage(bytes memory message) internal virtual {
        cctpMessageTransmitter.sendMessage(
            peerDomainID,
            bytes32(uint256(uint160(destinationStrategy))),
            bytes32(uint256(uint160(destinationStrategy))),
            minFinalityThreshold,
            message
        );
    }

    function isTransferPending() public view returns (bool) {
        uint64 nonce = lastTransferNonce;
        return nonce > 0 && !nonceProcessed[nonce];
    }

    function isNonceProcessed(uint64 nonce) public view returns (bool) {
        return nonceProcessed[nonce];
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
}
