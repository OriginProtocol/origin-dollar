// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title IBridgeReceiver
 * @author Origin Protocol Inc
 * @dev Receiver hook implemented by Master and Remote strategies. The configured inbound
 *      adapter forwards incoming bridge deliveries through this single entry point.
 *
 *      The adapter MUST have transferred any inbound tokens to the strategy before invoking
 *      this function. Tokens-with-message arrives via sendTokensAndMessage on the source;
 *      message-only arrives via sendMessage on the source. In both cases the strategy reads
 *      the fields below to dispatch by message type.
 */
interface IBridgeReceiver {
    /**
     * @notice Called by the authorised receiver adapter upon inbound bridge delivery.
     * @param nonce       Yield-channel nonce (0 for bridge-channel messages).
     * @param amount      Token amount delivered with the message (0 for message-only).
     * @param messageType Discriminator from CrossChainV3Helper message-type constants.
     * @param payload     Message-specific payload bytes (the envelope's body).
     */
    function receiveFromBridge(
        uint64 nonce,
        uint256 amount,
        uint8 messageType,
        bytes calldata payload
    ) external;
}
