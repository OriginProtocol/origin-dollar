// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

/**
 * @title CCIPMessageBuilder
 * @author Origin Protocol Inc
 *
 * @notice Shared builder for CCIP `Client.EVM2AnyMessage` payloads used by V3 adapters.
 *         Centralises the construction so the same shape (single token amount or zero,
 *         native fee, V1 extraArgs with a destination gas limit) lives in one place.
 *
 *         All V3 CCIP sends:
 *           - pay the bridge fee in native (`feeToken = address(0)`)
 *           - carry at most one token amount alongside the message
 *           - use `EVMExtraArgsV1` with the caller-supplied `destGasLimit`
 */
library CCIPMessageBuilder {
    /**
     * @dev Build the CCIP `Client.EVM2AnyMessage`.
     * @param token         Token to bridge alongside the message; `address(0)` for message-only.
     * @param amount        Token amount; ignored when `token == address(0)`.
     * @param message       Envelope-wrapped V3 message bytes (may be empty).
     * @param peerReceiver  Destination-chain receiver address (the peer adapter).
     * @param destGasLimit  Gas to make available on the destination for the receiver callback.
     */
    function build(
        address token,
        uint256 amount,
        bytes memory message,
        address peerReceiver,
        uint256 destGasLimit
    ) internal pure returns (Client.EVM2AnyMessage memory) {
        Client.EVMTokenAmount[] memory tokenAmounts;
        if (token != address(0) && amount > 0) {
            tokenAmounts = new Client.EVMTokenAmount[](1);
            tokenAmounts[0] = Client.EVMTokenAmount({
                token: token,
                amount: amount
            });
        } else {
            tokenAmounts = new Client.EVMTokenAmount[](0);
        }
        return
            Client.EVM2AnyMessage({
                receiver: abi.encode(peerReceiver),
                data: message,
                tokenAmounts: tokenAmounts,
                feeToken: address(0), // pay in native
                extraArgs: Client._argsToBytes(
                    Client.EVMExtraArgsV1({ gasLimit: destGasLimit })
                )
            });
    }
}
