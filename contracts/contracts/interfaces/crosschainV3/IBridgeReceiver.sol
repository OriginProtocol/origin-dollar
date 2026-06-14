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
 *         `amountReceived`. Any transport-side fee is emitted by the adapter's
 *         `MessageDelivered` event for off-chain consumers — it is not forwarded here because
 *         no strategy reads it.
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
     * @param payload        Strategy-owned opaque bytes from the source envelope.
     */
    function receiveMessage(
        address sender,
        address token,
        uint256 amountReceived,
        bytes calldata payload
    ) external;
}
