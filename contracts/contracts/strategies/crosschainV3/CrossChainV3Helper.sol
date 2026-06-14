// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title CrossChainV3Helper
 * @author Origin Protocol Inc
 *
 * @dev Strategy-level message-type constants and payload codecs for OUSD V3
 *      cross-chain messages. The wire envelope (sender + intendedAmount + payload) is
 *      bridge-adapter-internal; strategies only encode and decode the per-message-type
 *      payloads below, with the message type discriminator embedded inside the payload
 *      itself.
 */
library CrossChainV3Helper {
    // --- Message type discriminators ---------------------------------------

    // Yield channel (nonce-gated, one operation in flight at a time)

    /// @notice Master → Remote: deposit `amount` of bridgeAsset (carried by the adapter).
    uint32 internal constant DEPOSIT = 1;
    /// @notice Remote → Master: deposit acknowledgement with Remote's yield-only baseline (OToken 18dp).
    uint32 internal constant DEPOSIT_ACK = 2;
    /// @notice Master → Remote: leg-1 withdrawal request for `amount` of bridgeAsset.
    uint32 internal constant WITHDRAW_REQUEST = 3;
    /// @notice Remote → Master: leg-1 acknowledgement with Remote's yield-only baseline (OToken 18dp).
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
    /// @notice Remote → Master: settlement acknowledgement with Remote's yield-only baseline (OToken 18dp).
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

    // --- Strategy-level envelope (msgType + nonce + body) -------------------
    //
    // Strategies wrap their per-op body bytes inside a small strategy-owned envelope so a
    // single `payload` field can carry message-type discrimination and a yield-channel
    // nonce without leaking those concerns into the bridge adapter. The adapter sees the
    // strategy envelope as opaque bytes.

    /**
     * @notice Build the strategy-level envelope: `abi.encode(msgType, nonce, body)`.
     */
    function packPayload(
        uint32 msgType,
        uint64 nonce,
        bytes memory body
    ) internal pure returns (bytes memory) {
        return abi.encode(msgType, nonce, body);
    }

    /**
     * @notice Decode the strategy-level envelope.
     */
    function unpackPayload(bytes memory payload)
        internal
        pure
        returns (
            uint32 msgType,
            uint64 nonce,
            bytes memory body
        )
    {
        (msgType, nonce, body) = abi.decode(payload, (uint32, uint64, bytes));
    }

    // --- Per-message payload encoders / decoders ----------------------------
    //
    // DEPOSIT                       : payload empty; amount is carried by the adapter
    // DEPOSIT_ACK                   : payload = abi.encode(yieldBaseline)
    // WITHDRAW_REQUEST              : payload = abi.encode(amount)
    // WITHDRAW_REQUEST_ACK          : payload = abi.encode(yieldBaseline)
    // WITHDRAW_CLAIM                : payload empty
    // WITHDRAW_CLAIM_ACK            : payload = abi.encode(yieldBaseline, success, amount)
    // BALANCE_CHECK_REQUEST         : payload = abi.encode(timestamp)
    // BALANCE_CHECK_RESPONSE        : payload = abi.encode(balance, timestamp)
    // SETTLE_BRIDGE_ACCOUNTING      : payload = abi.encode(int256 snapshot)
    // SETTLE_BRIDGE_ACCOUNTING_ACK  : payload = abi.encode(yieldBaseline)
    // BRIDGE_IN / BRIDGE_OUT        : payload = abi.encode(BridgeUserPayload)

    /**
     * @notice Encode a single-`uint256` payload — shared by every message whose body is one
     *         uint256: DEPOSIT_ACK / WITHDRAW_REQUEST_ACK / SETTLE_BRIDGE_ACCOUNTING_ACK (a
     *         balance), WITHDRAW_REQUEST (an amount), BALANCE_CHECK_REQUEST (a timestamp).
     */
    function encodeUint256(uint256 value) internal pure returns (bytes memory) {
        return abi.encode(value);
    }

    /// @notice Decode the single-`uint256` payload above.
    function decodeUint256(bytes memory payload)
        internal
        pure
        returns (uint256)
    {
        return abi.decode(payload, (uint256));
    }

    /**
     * @notice Encode the WITHDRAW_CLAIM_ACK payload. The only R→M yield message that
     *         carries tokens — `amount` pins the exact bridgeAsset bundled with the
     *         message (0 on NACK or message-only) so split-delivery receivers can set
     *         `expectedAmount` without inspecting the bridge transport.
     * @param yieldBaseline Remote's yield-only baseline (OToken 18dp) after the claim leg.
     * @param success    `true` if the claim shipped tokens, `false` if leg-2 NACK'd.
     * @param amount     bridgeAsset units bundled with this ack; 0 when `success` is false.
     */
    function encodeWithdrawClaimAckPayload(
        uint256 yieldBaseline,
        bool success,
        uint256 amount
    ) internal pure returns (bytes memory) {
        return abi.encode(yieldBaseline, success, amount);
    }

    /// @notice Decode the WITHDRAW_CLAIM_ACK 3-tuple payload.
    function decodeWithdrawClaimAckPayload(bytes memory payload)
        internal
        pure
        returns (
            uint256 yieldBaseline,
            bool success,
            uint256 amount
        )
    {
        return abi.decode(payload, (uint256, bool, uint256));
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
        // Field-by-field, NOT `abi.encode(p)`: this struct has a dynamic member
        // (`callData`), so `abi.encode(struct)` would prepend an extra offset word and
        // diverge from this established wire layout (and from the JS test encoders /
        // already-deployed peers). Keep the flat tuple.
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
