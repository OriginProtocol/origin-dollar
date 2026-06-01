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
 *        [0:4]   uint32 version  (always ORIGIN_V3_MESSAGE_VERSION)
 *        [4:8]   uint32 msgType  (one of the constants below)
 *        [8:16]  uint64 nonce    (yield-channel nonce; 0 for bridge-channel messages)
 *        [16:]   bytes  payload  (abi.encode of message-specific fields)
 *
 *      The 4 + 4 + 8 = 16-byte header is intentionally word-misaligned at runtime
 *      because abi.encodePacked emits each field at its natural width. Reads use
 *      BytesHelper and a small extractUint64 helper here.
 */
library CrossChainV3Helper {
    using BytesHelper for bytes;

    // --- Wire constants -----------------------------------------------------

    uint32 internal constant ORIGIN_V3_MESSAGE_VERSION = 2010;
    uint256 internal constant HEADER_LENGTH = 16;

    // --- Message type discriminators ---------------------------------------

    // Yield channel (nonce-gated, one operation in flight at a time)
    uint32 internal constant YIELD_DEPOSIT = 1;
    uint32 internal constant YIELD_DEPOSIT_ACK = 2;
    uint32 internal constant WITHDRAW_REQUEST = 3;
    uint32 internal constant WITHDRAW_REQUEST_ACK = 4;
    uint32 internal constant WITHDRAW_CLAIM = 5;
    uint32 internal constant WITHDRAW_CLAIM_ACK = 6;
    uint32 internal constant BALANCE_CHECK_REQUEST = 7;
    uint32 internal constant BALANCE_CHECK_RESPONSE = 8;
    uint32 internal constant SETTLE_BRIDGE = 9;
    uint32 internal constant SETTLE_BRIDGE_ACK = 10;

    // Bridge channel (nonceless, multiple operations in flight)
    uint32 internal constant BRIDGE_IN = 11;
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

    function wrap(
        uint32 msgType,
        uint64 nonce,
        bytes memory payload
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                ORIGIN_V3_MESSAGE_VERSION,
                msgType,
                nonce,
                payload
            );
    }

    function unwrap(bytes memory message)
        internal
        pure
        returns (
            uint32 version,
            uint32 msgType,
            uint64 nonce,
            bytes memory payload
        )
    {
        require(message.length >= HEADER_LENGTH, "V3: message too short");
        version = message.extractUint32(0);
        msgType = message.extractUint32(4);
        nonce = extractUint64(message, 8);
        payload = message.extractSlice(HEADER_LENGTH, message.length);
    }

    function getVersion(bytes memory message) internal pure returns (uint32) {
        return message.extractUint32(0);
    }

    function getMessageType(bytes memory message)
        internal
        pure
        returns (uint32)
    {
        return message.extractUint32(4);
    }

    function getNonce(bytes memory message) internal pure returns (uint64) {
        return extractUint64(message, 8);
    }

    function getPayload(bytes memory message)
        internal
        pure
        returns (bytes memory)
    {
        return message.extractSlice(HEADER_LENGTH, message.length);
    }

    function verifyVersion(bytes memory message) internal pure {
        require(
            getVersion(message) == ORIGIN_V3_MESSAGE_VERSION,
            "V3: invalid version"
        );
    }

    /**
     * @dev BytesHelper ships extractUint32 / extractAddress / extractUint256 but
     *      not uint64. Read the 8-byte big-endian slot with a tight loop —
     *      the nonce slot is the only consumer so the per-call cost is bounded.
     */
    function extractUint64(bytes memory data, uint256 start)
        internal
        pure
        returns (uint64 result)
    {
        require(data.length >= start + 8, "V3: uint64 out of range");
        for (uint256 i = 0; i < 8; i++) {
            result = (result << 8) | uint64(uint8(data[start + i]));
        }
    }

    // --- Per-message payload encoders / decoders ----------------------------
    //
    // YIELD_DEPOSIT      : payload empty; amount is the adapter's `amount` param
    // YIELD_DEPOSIT_ACK  : payload = abi.encode(newBalance)
    // WITHDRAW_REQUEST   : payload = abi.encode(amount) (leg-1 amount Master is requesting)
    // WITHDRAW_REQUEST_ACK: payload = abi.encode(newBalance)
    // WITHDRAW_CLAIM     : payload empty
    // WITHDRAW_CLAIM_ACK : payload = abi.encode(newBalance, success, amount)
    //   `amount` is the bridgeAsset quantity bundled with this ack (0 on NACK / message-only).
    //   Split-delivery receivers decode it to set the exact `expectedAmount` for store-and-
    //   process; atomic receivers read it from the bridge transport directly.
    // BALANCE_CHECK_REQUEST : payload = abi.encode(timestamp)
    // BALANCE_CHECK_RESPONSE: payload = abi.encode(balance, timestamp)
    // SETTLE_BRIDGE      : payload empty
    // SETTLE_BRIDGE_ACK  : payload = abi.encode(newBalance)
    // BRIDGE_IN / BRIDGE_OUT: payload = abi.encode(BridgeUserPayload)

    function encodeNewBalancePayload(uint256 newBalance)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(newBalance);
    }

    function decodeNewBalancePayload(bytes memory payload)
        internal
        pure
        returns (uint256 newBalance)
    {
        return abi.decode(payload, (uint256));
    }

    function encodeAmountPayload(uint256 amount)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(amount);
    }

    function decodeAmountPayload(bytes memory payload)
        internal
        pure
        returns (uint256 amount)
    {
        return abi.decode(payload, (uint256));
    }

    function encodeWithdrawClaimAckPayload(
        uint256 newBalance,
        bool success,
        uint256 amount
    ) internal pure returns (bytes memory) {
        return abi.encode(newBalance, success, amount);
    }

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

    function encodeBalanceCheckRequestPayload(uint256 timestamp)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(timestamp);
    }

    function decodeBalanceCheckRequestPayload(bytes memory payload)
        internal
        pure
        returns (uint256 timestamp)
    {
        return abi.decode(payload, (uint256));
    }

    function encodeBalanceCheckResponsePayload(
        uint256 balance,
        uint256 timestamp
    ) internal pure returns (bytes memory) {
        return abi.encode(balance, timestamp);
    }

    function decodeBalanceCheckResponsePayload(bytes memory payload)
        internal
        pure
        returns (uint256 balance, uint256 timestamp)
    {
        return abi.decode(payload, (uint256, uint256));
    }

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
