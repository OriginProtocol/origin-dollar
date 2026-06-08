// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title IBridgeReceiver
 * @author Origin Protocol Inc
 *
 * @notice Receiver hook implemented by Master and Remote strategies. The configured inbound
 *         adapter forwards incoming bridge deliveries through this single entry point.
 *
 *         The adapter MUST have transferred any inbound tokens to the strategy before
 *         invoking this function. The `amountReceived` argument carries the actual landed
 *         amount (post any transport-side fee deduction); the strategy accounts on
 *         `amountReceived` and may use `feePaid` for telemetry or sanity checks against the
 *         sender's intended amount carried inside `payload`.
 */
interface IBridgeReceiver {
    /**
     * @notice Called by the authorised inbound adapter when a message lands.
     * @param sender         Strategy address on the source chain — under CREATE3 parity, the
     *                       same address as the destination strategy on this chain.
     * @param token          Token delivered alongside the message; `address(0)` for
     *                       message-only deliveries.
     * @param amountReceived Actual amount of `token` transferred to this strategy by the
     *                       adapter immediately before this call (already received).
     * @param feePaid        Transport-side fee deducted from the sender's intended amount
     *                       (e.g., CCTP V2 fast-finality fee). Informational; the strategy's
     *                       accounting is on `amountReceived`.
     * @param payload        Strategy-owned opaque bytes from the source envelope.
     */
    function receiveMessage(
        address sender,
        address token,
        uint256 amountReceived,
        uint256 feePaid,
        bytes calldata payload
    ) external;
}
