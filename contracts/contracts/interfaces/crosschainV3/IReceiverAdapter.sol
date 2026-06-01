// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title IReceiverAdapter
 * @author Origin Protocol Inc
 * @dev Interface common to all inbound bridge adapters. Atomic adapters (CCTP, CCIP) ignore
 *      processStoredMessage / hasPendingMessage (they always forward immediately). Split-delivery
 *      adapters (canonical bridge for tokens + separate message bridge) hold a single pending
 *      slot and use this interface so off-chain automation can finalise delivery once both legs
 *      have landed.
 */
interface IReceiverAdapter {
    /**
     * @notice Whether the adapter currently has a stored message waiting for its companion token leg.
     */
    function hasPendingMessage() external view returns (bool);

    /**
     * @notice Permissionless finaliser: if both message and tokens have arrived, forward to the
     *         strategy and clear the pending slot. No-op when nothing is pending or only one leg has
     *         landed. Reverts on actual delivery failure so off-chain automation can retry.
     */
    function processStoredMessage() external;
}
