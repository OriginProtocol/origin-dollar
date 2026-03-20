// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ICCTPTokenMessenger {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external;

    function depositForBurnWithHook(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold,
        bytes memory hookData
    ) external;

    function getMinFeeAmount(uint256 amount) external view returns (uint256);
}

interface ICCTPMessageTransmitter {
    function sendMessage(
        uint32 destinationDomain,
        bytes32 recipient,
        bytes32 destinationCaller,
        uint32 minFinalityThreshold,
        bytes memory messageBody
    ) external;

    function receiveMessage(bytes calldata message, bytes calldata attestation)
        external
        returns (bool);
}

interface IMessageHandlerV2 {
    /**
     * @notice Handles an incoming finalized message from an IReceiverV2
     * @dev Finalized messages have finality threshold values greater than or equal to 2000
     * @param sourceDomain The source domain of the message
     * @param sender The sender of the message
     * @param finalityThresholdExecuted the finality threshold at which the message was attested to
     * @param messageBody The raw bytes of the message body
     * @return success True, if successful; false, if not.
     */
    function handleReceiveFinalizedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes calldata messageBody
    ) external returns (bool);

    /**
     * @notice Handles an incoming unfinalized message from an IReceiverV2
     * @dev Unfinalized messages have finality threshold values less than 2000
     * @param sourceDomain The source domain of the message
     * @param sender The sender of the message
     * @param finalityThresholdExecuted The finality threshold at which the message was attested to
     * @param messageBody The raw bytes of the message body
     * @return success True, if successful; false, if not.
     */
    function handleReceiveUnfinalizedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes calldata messageBody
    ) external returns (bool);
}
