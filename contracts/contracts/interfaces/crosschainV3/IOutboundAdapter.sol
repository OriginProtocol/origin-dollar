// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title IOutboundAdapter
 * @author Origin Protocol Inc
 * @dev Bridge-agnostic outbound adapter interface used by Master / Remote strategies in the
 *      OUSD V3 cross-chain strategy pair. An adapter encapsulates a single bridge transport
 *      (CCTP, CCIP, canonical L1↔L2 bridges, etc.) so the strategy stays bridge-ignorant.
 *
 *      Atomic bridges (CCTP, CCIP) can have a single adapter instance shared across multiple
 *      strategy pairs. Split-delivery bridges (canonical) get a dedicated instance per pair to
 *      prevent token misrouting.
 */
interface IOutboundAdapter {
    /**
     * @notice Send tokens together with a message to the configured peer.
     *         Used by the yield channel for deposits and withdrawal claim responses.
     * @param token   Token to bridge (must be approved to the adapter by the caller).
     * @param amount  Token amount to bridge.
     * @param message Envelope-wrapped message bytes (see CrossChainV3Helper).
     */
    function sendTokensAndMessage(
        address token,
        uint256 amount,
        bytes calldata message
    ) external payable;

    /**
     * @notice Send a message-only payload to the configured peer.
     *         Used for acks, balance checks, settlement, and bridge-channel ops.
     * @param message Envelope-wrapped message bytes (see CrossChainV3Helper).
     */
    function sendMessage(bytes calldata message) external payable;

    /**
     * @notice Estimate the bridge fee for the given operation.
     * @param amount    Token amount to bridge (0 for message-only).
     * @param message   Envelope-wrapped message bytes.
     * @return nativeFee Native gas fee required as msg.value.
     * @return tokenFee  Token-denominated fee (e.g., LINK for CCIP), if applicable.
     */
    function estimateFee(uint256 amount, bytes calldata message)
        external
        view
        returns (uint256 nativeFee, uint256 tokenFee);
}
