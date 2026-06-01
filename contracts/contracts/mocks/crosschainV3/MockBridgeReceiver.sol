// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IBridgeReceiver } from "../../interfaces/crosschainV3/IBridgeReceiver.sol";

/**
 * @title MockBridgeReceiver
 * @notice TEST-ONLY recorder for `receiveFromBridge` calls. Used to assert what an
 *         inbound adapter forwarded after split-delivery store-and-process.
 */
contract MockBridgeReceiver is IBridgeReceiver {
    uint64 public lastNonce;
    uint256 public lastAmount;
    uint8 public lastMessageType;
    bytes public lastPayload;
    uint256 public callCount;

    function receiveFromBridge(
        uint64 nonce,
        uint256 amount,
        uint8 messageType,
        bytes calldata payload
    ) external override {
        lastNonce = nonce;
        lastAmount = amount;
        lastMessageType = messageType;
        lastPayload = payload;
        callCount += 1;
    }
}
