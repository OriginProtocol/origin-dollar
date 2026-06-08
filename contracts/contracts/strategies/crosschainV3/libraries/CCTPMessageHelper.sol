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

    /// @notice Inner burn-message body offsets for CCTP V2 burn messages. The burn body is
    ///         what TokenMessenger constructs and ships inside the transport `messageBody`
    ///         field when `depositForBurnWithHook` is called. We parse it manually in
    ///         `CCTPAdapter.relay()` so the adapter has the authoritative `amount`,
    ///         `feeExecuted`, and `hookData` rather than relying on
    ///         `IERC20.balanceOf(adapter)` (susceptible to donations) or on the
    ///         `IMessageHandlerV2` callback (which behaves differently across CCTP V2.0
    ///         and V2.1 deployments).
    ///
    ///         Ref: https://github.com/circlefin/evm-cctp-contracts/blob/master/src/messages/v2/BurnMessageV2.sol
    uint256 private constant BURN_BODY_VERSION_INDEX = 0;
    uint256 private constant BURN_BODY_BURN_TOKEN_INDEX = 4;
    uint256 private constant BURN_BODY_MINT_RECIPIENT_INDEX = 36;
    uint256 private constant BURN_BODY_AMOUNT_INDEX = 68;
    uint256 private constant BURN_BODY_MESSAGE_SENDER_INDEX = 100;
    uint256 private constant BURN_BODY_FEE_EXECUTED_INDEX = 164;
    uint256 private constant BURN_BODY_HOOK_DATA_INDEX = 228;

    /**
     * @notice Split a CCTP V2 wire message into its transport header fields plus the inner
     *         `messageBody`. The body is either:
     *           - a burn-message body (for `depositForBurnWithHook`-sourced messages), or
     *           - the raw application envelope (for `MessageTransmitter.sendMessage`).
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

    /**
     * @notice Decode a CCTP V2 burn-message body into its authoritative fields. Use this
     *         when the transport header's `sender` indicates the message originated from
     *         the source-side TokenMessenger (i.e., a `depositForBurnWithHook` rather than
     *         a plain `sendMessage`).
     * @param body The inner CCTP V2 burn message body.
     * @return burnToken The token burned on source (must equal local USDC).
     * @return amount Source-side burn amount.
     * @return msgSender The source-side caller of `depositForBurnWithHook` (peer adapter
     *                  under CREATE3 parity).
     * @return feeExecuted Protocol fee deducted from `amount` on destination. `amount -
     *                    feeExecuted` USDC arrives at the mintRecipient.
     * @return hookData Opaque payload set by the source side via the `hookData` arg of
     *                  `depositForBurnWithHook`. This is our application envelope.
     */
    function decodeBurnBody(bytes memory body)
        internal
        pure
        returns (
            address burnToken,
            uint256 amount,
            address msgSender,
            uint256 feeExecuted,
            bytes memory hookData
        )
    {
        require(
            body.length >= BURN_BODY_HOOK_DATA_INDEX,
            "CCTP: burn body too short"
        );
        burnToken = body.extractAddress(BURN_BODY_BURN_TOKEN_INDEX);
        amount = body.extractUint256(BURN_BODY_AMOUNT_INDEX);
        msgSender = body.extractAddress(BURN_BODY_MESSAGE_SENDER_INDEX);
        feeExecuted = body.extractUint256(BURN_BODY_FEE_EXECUTED_INDEX);
        hookData = body.extractSlice(BURN_BODY_HOOK_DATA_INDEX, body.length);
    }
}
