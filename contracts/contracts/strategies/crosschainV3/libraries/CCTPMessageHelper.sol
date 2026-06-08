// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BytesHelper } from "../../../utils/BytesHelper.sol";

/**
 * @title CCTPMessageHelper
 * @author Origin Protocol Inc
 *
 * @notice Minimal decoder for the CCTP V2 transport-level message header. Used by
 *         `CCTPAdapter.relay` to do cheap pre-validation (correct CCTP message version,
 *         correct on-chain recipient) before paying the gas for attestation verification
 *         and the downstream `handleReceiveFinalizedMessage` callback.
 *
 *         The CCTP V2 wire format is owned by Circle and looks like:
 *           [0..4)     uint32  version
 *           [4..8)     uint32  sourceDomain
 *           [8..12)    uint32  destinationDomain
 *           [12..44)   bytes32 nonce
 *           [44..76)   bytes32 sender              (right-aligned address)
 *           [76..108)  bytes32 recipient           (right-aligned address)
 *           [108..140) bytes32 destinationCaller   (right-aligned address)
 *           [140..144) uint32  minFinalityThreshold
 *           [144..148) uint32  finalityThresholdExecuted
 *           [148..]    bytes   messageBody         (our application envelope)
 *
 *         See https://developers.circle.com/cctp/technical-guide#message-header for the
 *         authoritative spec.
 */
library CCTPMessageHelper {
    using BytesHelper for bytes;

    /// @notice Wire-format version of CCTP V2 messages.
    uint32 internal constant CCTP_V2_VERSION = 1;

    uint256 private constant VERSION_INDEX = 0;
    uint256 private constant SOURCE_DOMAIN_INDEX = 4;
    uint256 private constant SENDER_INDEX = 44;
    uint256 private constant RECIPIENT_INDEX = 76;
    uint256 private constant MESSAGE_BODY_INDEX = 148;

    /**
     * @notice Split a CCTP V2 wire message into its transport header fields plus the inner
     *         `messageBody`. The body contains our application envelope, which the adapter's
     *         `_validateInbound` decodes later from inside `handleReceiveFinalizedMessage`.
     * @param message The CCTP V2 wire message bytes as received from Circle's attestation API.
     */
    function decodeMessageHeader(bytes memory message)
        internal
        pure
        returns (
            uint32 version,
            uint32 sourceDomain,
            address sender,
            address recipient,
            bytes memory messageBody
        )
    {
        version = message.extractUint32(VERSION_INDEX);
        sourceDomain = message.extractUint32(SOURCE_DOMAIN_INDEX);
        sender = message.extractAddress(SENDER_INDEX);
        recipient = message.extractAddress(RECIPIENT_INDEX);
        messageBody = message.extractSlice(MESSAGE_BODY_INDEX, message.length);
    }
}
