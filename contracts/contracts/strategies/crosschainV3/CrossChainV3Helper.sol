// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BytesHelper } from "../../utils/BytesHelper.sol";

/**
 * @title CrossChainV3Helper
 * @author Origin Protocol Inc
 *
 * @dev Message envelope and payload codec for OUSD V3 cross-chain messages.
 *
 *      The envelope is bridge-agnostic — adapters wrap and unwrap it without any
 *      knowledge of the underlying message-type semantics.
 *
 *      Envelope layout (abi.encodePacked, no padding between fields):
 *        [0:4]   uint32  version  (always ORIGIN_V3_MESSAGE_VERSION)
 *        [4:8]   uint32  msgType  (one of the constants below)
 *        [8:16]  uint64  nonce    (yield-channel nonce; 0 for bridge-channel messages)
 *        [16:36] address sender   (source strategy address — the inbound adapter delivers
 *                                  to this same address on the destination chain, relying
 *                                  on CreateX-driven cross-chain address parity)
 *        [36:]   bytes   payload  (abi.encode of message-specific fields)
 *
 *      The 4 + 4 + 8 + 20 = 36-byte header is intentionally word-misaligned at runtime
 *      because abi.encodePacked emits each field at its natural width.
 */
library CrossChainV3Helper {
    using BytesHelper for bytes;

    // --- Wire constants -----------------------------------------------------

    /// @notice On-wire version tag for the V3 envelope. Bumped whenever the envelope
    ///         layout or message-type semantics change in a non-backward-compatible way.
    uint32 internal constant ORIGIN_V3_MESSAGE_VERSION = 1020;

    /// @notice Byte length of the fixed envelope header (4 + 4 + 8 + 20).
    uint256 internal constant HEADER_LENGTH = 36;

    /// @notice Byte offset of the address field (`sender`) inside the header.
    uint256 internal constant SENDER_OFFSET = 16;

    // --- Message type discriminators ---------------------------------------

    // Yield channel (nonce-gated, one operation in flight at a time)

    /// @notice Master → Remote: deposit `amount` of bridgeAsset (carried by the adapter).
    uint32 internal constant DEPOSIT = 1;
    /// @notice Remote → Master: deposit acknowledgement with Remote's new checkBalance.
    uint32 internal constant DEPOSIT_ACK = 2;
    /// @notice Master → Remote: leg-1 withdrawal request for `amount` of bridgeAsset.
    uint32 internal constant WITHDRAW_REQUEST = 3;
    /// @notice Remote → Master: leg-1 acknowledgement with Remote's new checkBalance.
    uint32 internal constant WITHDRAW_REQUEST_ACK = 4;
    /// @notice Master → Remote: leg-2 trigger to ship the previously-queued amount.
    uint32 internal constant WITHDRAW_CLAIM = 5;
    /// @notice Remote → Master: leg-2 ack carrying bridgeAsset on success.
    uint32 internal constant WITHDRAW_CLAIM_ACK = 6;
    /// @notice Master → Remote: read Remote's balance snapshot at a given timestamp.
    uint32 internal constant BALANCE_CHECK_REQUEST = 7;
    /// @notice Remote → Master: balance response (balance + originating timestamp).
    uint32 internal constant BALANCE_CHECK_RESPONSE = 8;
    /// @notice Master → Remote: clear the bridge-adjustment accounting on both sides.
    uint32 internal constant SETTLE_BRIDGE_ACCOUNTING = 9;
    /// @notice Remote → Master: settlement acknowledgement with Remote's new checkBalance.
    uint32 internal constant SETTLE_BRIDGE_ACCOUNTING_ACK = 10;

    // Bridge channel (nonceless, multiple operations in flight)

    /// @notice Remote → Master: user-driven bridge of OToken from Ethereum onto the L2.
    uint32 internal constant BRIDGE_IN = 11;
    /// @notice Master → Remote: user-driven bridge of OToken from L2 back to Ethereum.
    uint32 internal constant BRIDGE_OUT = 12;

    // --- Bridge user payload (BRIDGE_IN / BRIDGE_OUT) -----------------------

    /**
     * @dev User-supplied payload for the bridge channel. Encoded inside the
     *      envelope body. The destination strategy uses `bridgeId` for replay
     *      protection (see Master / Remote `consumedBridgeIds` mapping) and
     *      validates `callGasLimit` against its adapter-configured maximum
     *      before issuing the optional post-delivery call.
     */
    struct BridgeUserPayload {
        bytes32 bridgeId;
        uint256 amount;
        address recipient;
        bytes callData;
        uint32 callGasLimit;
    }

    // --- Envelope wrap / unwrap --------------------------------------------

    /**
     * @notice Build the 36-byte header + payload envelope.
     * @dev Header is `abi.encodePacked(version, msgType, nonce, sender)`. The payload is
     *      appended verbatim; callers are responsible for `abi.encode`-ing it to
     *      match one of the per-message-type encoders below.
     *
     *      Strategies pass `address(this)` for `sender`. Inbound adapters trust this field
     *      and forward to the same address on the destination chain (CreateX-driven cross-
     *      chain address parity guarantees the destination strategy lives there).
     * @param msgType One of the message-type constants.
     * @param nonce   Yield-channel nonce; pass 0 for bridge-channel messages.
     * @param sender  Source strategy address (the destination on this chain by parity).
     * @param payload The message-specific body bytes.
     * @return The wrapped envelope.
     */
    function wrap(
        uint32 msgType,
        uint64 nonce,
        address sender,
        bytes memory payload
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                ORIGIN_V3_MESSAGE_VERSION,
                msgType,
                nonce,
                sender,
                payload
            );
    }

    /**
     * @notice Split an envelope back into its header fields and payload.
     * @dev Reverts if the envelope is shorter than the 36-byte header.
     * @param message The wrapped envelope.
     * @return version  Wire version from bytes [0:4].
     * @return msgType  Message-type discriminator from bytes [4:8].
     * @return nonce    Yield-channel nonce from bytes [8:16].
     * @return sender   Source strategy address from bytes [16:36].
     * @return payload  Trailing bytes after the header.
     */
    function unwrap(bytes memory message)
        internal
        pure
        returns (
            uint32 version,
            uint32 msgType,
            uint64 nonce,
            address sender,
            bytes memory payload
        )
    {
        require(message.length >= HEADER_LENGTH, "V3: message too short");
        version = message.extractUint32(0);
        msgType = message.extractUint32(4);
        nonce = message.extractUint64(8);
        sender = message.extractAddressPacked(SENDER_OFFSET);
        payload = message.extractSlice(HEADER_LENGTH, message.length);
    }

    /// @notice Read the version field from an envelope.
    function getVersion(bytes memory message) internal pure returns (uint32) {
        return message.extractUint32(0);
    }

    /// @notice Read the message-type discriminator from an envelope.
    function getMessageType(bytes memory message)
        internal
        pure
        returns (uint32)
    {
        return message.extractUint32(4);
    }

    /// @notice Read the yield-channel nonce from an envelope (0 for bridge-channel).
    function getNonce(bytes memory message) internal pure returns (uint64) {
        return message.extractUint64(8);
    }

    /// @notice Read the source strategy address from an envelope.
    function getSender(bytes memory message) internal pure returns (address) {
        return message.extractAddressPacked(SENDER_OFFSET);
    }

    /// @notice Read the payload (everything after the 36-byte header).
    function getPayload(bytes memory message)
        internal
        pure
        returns (bytes memory)
    {
        return message.extractSlice(HEADER_LENGTH, message.length);
    }

    /// @notice Revert if the envelope's version does not match this codec.
    function verifyVersion(bytes memory message) internal pure {
        require(
            getVersion(message) == ORIGIN_V3_MESSAGE_VERSION,
            "V3: invalid version"
        );
    }

    // --- Per-message payload encoders / decoders ----------------------------
    //
    // DEPOSIT                       : payload empty; amount is carried by the adapter
    // DEPOSIT_ACK                   : payload = abi.encode(newBalance)
    // WITHDRAW_REQUEST              : payload = abi.encode(amount)
    // WITHDRAW_REQUEST_ACK          : payload = abi.encode(newBalance)
    // WITHDRAW_CLAIM                : payload empty
    // WITHDRAW_CLAIM_ACK            : payload = abi.encode(newBalance, success, amount)
    // BALANCE_CHECK_REQUEST         : payload = abi.encode(timestamp)
    // BALANCE_CHECK_RESPONSE        : payload = abi.encode(balance, timestamp)
    // SETTLE_BRIDGE_ACCOUNTING      : payload empty
    // SETTLE_BRIDGE_ACCOUNTING_ACK  : payload = abi.encode(newBalance)
    // BRIDGE_IN / BRIDGE_OUT        : payload = abi.encode(BridgeUserPayload)

    /**
     * @notice Encode the single-uint256 payload used by DEPOSIT_ACK,
     *         WITHDRAW_REQUEST_ACK, and SETTLE_BRIDGE_ACCOUNTING_ACK.
     * @param newBalance Remote's `checkBalance(bridgeAsset)` snapshot after the op.
     */
    function encodeNewBalancePayload(uint256 newBalance)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(newBalance);
    }

    /// @notice Decode the single-uint256 payload above.
    function decodeNewBalancePayload(bytes memory payload)
        internal
        pure
        returns (uint256 newBalance)
    {
        return abi.decode(payload, (uint256));
    }

    /**
     * @notice Encode the WITHDRAW_REQUEST payload (the leg-1 amount Master wants).
     * @param amount  bridgeAsset units to withdraw.
     */
    function encodeAmountPayload(uint256 amount)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(amount);
    }

    /// @notice Decode the WITHDRAW_REQUEST payload.
    function decodeAmountPayload(bytes memory payload)
        internal
        pure
        returns (uint256 amount)
    {
        return abi.decode(payload, (uint256));
    }

    /**
     * @notice Encode the WITHDRAW_CLAIM_ACK payload. The only R→M yield message that
     *         carries tokens — `amount` pins the exact bridgeAsset bundled with the
     *         message (0 on NACK or message-only) so split-delivery receivers can set
     *         `expectedAmount` without inspecting the bridge transport.
     * @param newBalance Remote's `checkBalance` after the claim leg.
     * @param success    `true` if the claim shipped tokens, `false` if leg-2 NACK'd.
     * @param amount     bridgeAsset units bundled with this ack; 0 when `success` is false.
     */
    function encodeWithdrawClaimAckPayload(
        uint256 newBalance,
        bool success,
        uint256 amount
    ) internal pure returns (bytes memory) {
        return abi.encode(newBalance, success, amount);
    }

    /// @notice Decode the WITHDRAW_CLAIM_ACK 3-tuple payload.
    function decodeWithdrawClaimAckPayload(bytes memory payload)
        internal
        pure
        returns (
            uint256 newBalance,
            bool success,
            uint256 amount
        )
    {
        return abi.decode(payload, (uint256, bool, uint256));
    }

    /// @notice Encode the BALANCE_CHECK_REQUEST payload (origin timestamp).
    function encodeBalanceCheckRequestPayload(uint256 timestamp)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(timestamp);
    }

    /// @notice Decode the BALANCE_CHECK_REQUEST payload.
    function decodeBalanceCheckRequestPayload(bytes memory payload)
        internal
        pure
        returns (uint256 timestamp)
    {
        return abi.decode(payload, (uint256));
    }

    /// @notice Encode the BALANCE_CHECK_RESPONSE payload (balance + originating ts).
    function encodeBalanceCheckResponsePayload(
        uint256 balance,
        uint256 timestamp
    ) internal pure returns (bytes memory) {
        return abi.encode(balance, timestamp);
    }

    /// @notice Decode the BALANCE_CHECK_RESPONSE 2-tuple payload.
    function decodeBalanceCheckResponsePayload(bytes memory payload)
        internal
        pure
        returns (uint256 balance, uint256 timestamp)
    {
        return abi.decode(payload, (uint256, uint256));
    }

    /**
     * @notice Encode the BRIDGE_IN / BRIDGE_OUT payload — packs the 5 user-supplied
     *         fields the receiving strategy needs to deliver tokens and run the
     *         optional post-delivery call.
     */
    function encodeBridgeUserPayload(BridgeUserPayload memory p)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                p.bridgeId,
                p.amount,
                p.recipient,
                p.callData,
                p.callGasLimit
            );
    }

    /// @notice Decode the BRIDGE_IN / BRIDGE_OUT payload into a `BridgeUserPayload`.
    function decodeBridgeUserPayload(bytes memory payload)
        internal
        pure
        returns (BridgeUserPayload memory)
    {
        (
            bytes32 bridgeId,
            uint256 amount,
            address recipient,
            bytes memory callData,
            uint32 callGasLimit
        ) = abi.decode(payload, (bytes32, uint256, address, bytes, uint32));
        return
            BridgeUserPayload({
                bridgeId: bridgeId,
                amount: amount,
                recipient: recipient,
                callData: callData,
                callGasLimit: callGasLimit
            });
    }
}
