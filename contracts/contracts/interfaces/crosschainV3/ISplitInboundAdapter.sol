// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title ISplitInboundAdapter
 * @author Origin Protocol Inc
 * @dev Interface for split-delivery inbound bridge adapters — those where the message and
 *      its companion token leg arrive in separate transactions (e.g., OP Stack canonical
 *      bridge for the tokens + a separate message bridge for the envelope).
 *
 *      Atomic adapters (CCIP, CCTP V2 with combined token + message) do NOT implement this
 *      interface — they deliver in a single transaction and have no pending-slot lifecycle.
 *
 *      Split-delivery adapters are multi-tenant: each pending slot is keyed by the destination
 *      strategy's address on this chain (which equals the source sender by CREATE3 parity),
 *      so callers pass that address when querying or finalising.
 */
interface ISplitInboundAdapter {
    /**
     * @notice Whether the adapter currently has a stored message for `_target` waiting for
     *         its companion token leg.
     */
    function hasPendingMessage(address _target) external view returns (bool);

    /**
     * @notice Permissionless finaliser: if both message and tokens have arrived for
     *         `_target`, forward to it and clear that target's pending slot. Reverts when
     *         nothing is pending or the token leg hasn't landed yet, so off-chain automation
     *         can retry.
     */
    function processStoredMessage(address _target) external;
}
