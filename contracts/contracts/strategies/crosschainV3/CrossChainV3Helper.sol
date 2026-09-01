// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title CrossChainV3Helper
 * @author Origin Protocol Inc
 *
 * @dev Strategy-level message-type constants and payload codecs for the V3
 *      cross-chain yield channel. The wire envelope (sender + intendedAmount + payload) is
 *      bridge-adapter-internal; strategies only encode and decode the per-message-type
 *      payloads below, with the message type discriminator embedded inside the payload
 *      itself.
 */
library CrossChainV3Helper {
    // --- Message type discriminators ---------------------------------------

    // Yield channel (nonce-gated, one operation in flight at a time)

    /// @notice Master → Remote: deposit `amount` of bridgeAsset (carried by the adapter).
    uint32 internal constant DEPOSIT = 1;
    /// @notice Remote → Master: deposit acknowledgement with Remote's reported balance (OToken 18dp).
    uint32 internal constant DEPOSIT_ACK = 2;
    /// @notice Master → Remote: leg-1 withdrawal request for `amount` of bridgeAsset.
    uint32 internal constant WITHDRAW_REQUEST = 3;
    /// @notice Remote → Master: leg-1 acknowledgement with Remote's reported balance (OToken 18dp).
    uint32 internal constant WITHDRAW_REQUEST_ACK = 4;
    /// @notice Master → Remote: leg-2 trigger to ship the previously-queued amount.
    uint32 internal constant WITHDRAW_CLAIM = 5;
    /// @notice Remote → Master: leg-2 ack carrying bridgeAsset on success.
    uint32 internal constant WITHDRAW_CLAIM_ACK = 6;
    /// @notice Remote → Master: unprompted balance report (balance + Remote's timestamp).
    uint32 internal constant BALANCE_REPORT = 7;

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
    // DEPOSIT_ACK                   : payload = abi.encode(remoteBalance)
    // WITHDRAW_REQUEST              : payload = abi.encode(amount)
    // WITHDRAW_REQUEST_ACK          : payload = abi.encode(remoteBalance, success)
    // WITHDRAW_CLAIM                : payload empty
    // WITHDRAW_CLAIM_ACK            : payload = abi.encode(remoteBalance, success, amount)
    // BALANCE_REPORT                : payload = abi.encode(balance, timestamp)

    /**
     * @notice Encode a single-`uint256` payload — shared by every message whose body is one
     *         uint256: DEPOSIT_ACK (a balance) and WITHDRAW_REQUEST (an amount).
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
     * @param remoteBalance Remote's reported balance (OToken 18dp) after the claim leg.
     * @param success    `true` if the claim shipped tokens, `false` if leg-2 NACK'd.
     * @param amount     bridgeAsset units bundled with this ack; 0 when `success` is false.
     */
    function encodeWithdrawClaimAckPayload(
        uint256 remoteBalance,
        bool success,
        uint256 amount
    ) internal pure returns (bytes memory) {
        return abi.encode(remoteBalance, success, amount);
    }

    /// @notice Decode the WITHDRAW_CLAIM_ACK 3-tuple payload.
    function decodeWithdrawClaimAckPayload(bytes memory payload)
        internal
        pure
        returns (
            uint256 remoteBalance,
            bool success,
            uint256 amount
        )
    {
        return abi.decode(payload, (uint256, bool, uint256));
    }

    /**
     * @notice Encode the WITHDRAW_REQUEST_ACK payload.
     * @param remoteBalance Remote's reported balance (OToken 18dp) after the leg-1 request.
     * @param success    `true` if Remote queued the withdrawal; `false` if the unwrap/queue failed
     *                   (Remote queued nothing, so Master must clear its pending withdrawal and the
     *                   two-leg flow does not proceed to a claim).
     */
    function encodeWithdrawRequestAckPayload(
        uint256 remoteBalance,
        bool success
    ) internal pure returns (bytes memory) {
        return abi.encode(remoteBalance, success);
    }

    /// @notice Decode the WITHDRAW_REQUEST_ACK 2-tuple payload.
    function decodeWithdrawRequestAckPayload(bytes memory payload)
        internal
        pure
        returns (uint256 remoteBalance, bool success)
    {
        return abi.decode(payload, (uint256, bool));
    }

    /// @notice Encode the BALANCE_REPORT payload (balance + Remote's `block.timestamp`).
    function encodeBalanceReportPayload(uint256 balance, uint256 timestamp)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(balance, timestamp);
    }

    /// @notice Decode the BALANCE_REPORT 2-tuple payload.
    function decodeBalanceReportPayload(bytes memory payload)
        internal
        pure
        returns (uint256 balance, uint256 timestamp)
    {
        return abi.decode(payload, (uint256, uint256));
    }
}
