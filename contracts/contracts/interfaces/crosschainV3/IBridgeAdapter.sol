// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title IBridgeAdapter
 * @author Origin Protocol Inc
 *
 * @notice Bridge-agnostic adapter interface used by Master / Remote strategies. The adapter
 *         encapsulates one bridge transport (CCIP, CCTP, OP Stack canonical bridge) so the
 *         strategy stays bridge-ignorant. The adapter owns the envelope shape; the strategy
 *         only ever passes its own opaque `payload` bytes.
 *
 *         A single adapter deployment serves all authorised strategies on its chain, with
 *         per-sender lane configuration held inside the adapter. Each adapter is bound to
 *         one peer chain through the lane configuration.
 */
interface IBridgeAdapter {
    /**
     * @notice Send a message-only payload to the configured peer.
     * @dev    Strategy passes opaque `payload`; the adapter wraps `(msg.sender, payload)` into
     *         its transport envelope. For bridges that require a native fee, caller must
     *         supply `msg.value >= quoteFee.fee` (the adapter checks). No refund of excess —
     *         overpayment stays on the adapter and can be recovered by governor via
     *         `transferToken(address(0), ...)`.
     */
    function sendMessage(bytes calldata payload) external payable;

    /**
     * @notice Send a token transfer alongside a message to the configured peer.
     * @dev    Adapter pulls `amount` of `token` from `msg.sender` via `safeTransferFrom`,
     *         then forwards via its bridge transport together with the wrapped envelope.
     *         Same `msg.value` semantics as `sendMessage`.
     */
    function sendMessageAndTokens(
        address token,
        uint256 amount,
        bytes calldata payload
    ) external payable;

    /**
     * @notice Quote the fee for the operation described by `(token, amount, payload)`.
     *
     * @return fee The fee amount, denominated in `feeToken`. When `feeToken == address(0)`
     *             this is a native (ETH) fee. When non-zero this is an ERC20 fee in that
     *             token. When the bridge protocol auto-deducts from the bridged amount
     *             (e.g., CCTP V2 fast-finality), `fee` is informational only — the actual
     *             deduction happens transparently inside the bridge, NOT on the caller.
     * @return feeToken The token the fee is denominated in. `address(0)` means native.
     * @return requiresExternalPayment True if the caller must supply `fee` of `feeToken`
     *             alongside the send call (e.g., via `msg.value` for native). False if the
     *             bridge protocol handles the fee transparently (e.g., deducts from the
     *             bridged token amount). The strategy reads this flag to decide whether to
     *             enforce a `msg.value` check; if false, the caller can ignore `fee`
     *             entirely.
     *
     *         The three-value return separates two orthogonal concerns:
     *           1. Pre-send caller action (do I need to pay anything separately?)
     *           2. Post-send accounting (the actual deduction is surfaced via
     *              `IBridgeReceiver.receiveMessage(... uint256 feePaid)` on the receiving
     *              side, independent of this quote).
     */
    function quoteFee(
        address token,
        uint256 amount,
        bytes calldata payload
    )
        external
        view
        returns (
            uint256 fee,
            address feeToken,
            bool requiresExternalPayment
        );

    /**
     * @notice Per-tx maximum token amount this adapter accepts on outbound, and the implied
     *         maximum it can deliver on inbound (since outbound and inbound are configured
     *         as mirror sides of the same protocol lane).
     *
     *         Strategies use this in two places:
     *           - Master.depositAll caps the locally-staged balance by
     *             `outboundAdapter.maxTransferAmount()` before sending.
     *           - Master.withdrawAll caps the requested amount by
     *             `inboundAdapter.maxTransferAmount()`, because Master can't query Remote's
     *             outbound across chains — the symmetric inbound adapter holds the same
     *             protocol-level cap.
     *
     *         `0` means "no enforcement" (unlimited). Concrete adapters layer additional
     *         protocol-level constants on top (e.g., CCTPAdapter enforces a hard 10M USDC
     *         cap regardless of the configured value).
     */
    function maxTransferAmount() external view returns (uint256);
}
