// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IBridgeReceiver } from "../../interfaces/crosschainV3/IBridgeReceiver.sol";

/**
 * @title MockBridgeReceiver
 * @notice TEST-ONLY recorder for `receiveMessage` calls. Used to assert what an
 *         inbound adapter forwarded after split-delivery store-and-process.
 */
contract MockBridgeReceiver is IBridgeReceiver {
    address public lastSender;
    address public lastToken;
    uint256 public lastAmount;
    bytes public lastPayload;
    uint256 public callCount;

    function receiveMessage(
        address sender,
        address token,
        uint256 amountReceived,
        bytes calldata payload
    ) external override {
        lastSender = sender;
        lastToken = token;
        lastAmount = amountReceived;
        lastPayload = payload;
        callCount += 1;
    }
}
