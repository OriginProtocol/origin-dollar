// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title NativeFeeHelper
 * @author Origin Protocol Inc
 *
 * @notice Legacy native-fee consumption helper used by `BridgedWOETHMigrationStrategy`.
 *         New crosschainV3 adapters source fees from `msg.value` / the pool and do NOT
 *         refund excess (it stays on the adapter); they do not use this library.
 *
 *         Two source paths:
 *           - `msg.value == 0` → pre-funded: the caller's `address(this).balance` covers
 *             the fee. Used by protocol-driven operations where the entry function is
 *             non-payable.
 *           - `msg.value > 0` → user-paid: caller supplied the fee; excess refunds to
 *             `msg.sender`.
 *
 *         Reverts when the chosen source doesn't cover `fee`.
 */
library NativeFeeHelper {
    function consume(uint256 fee) internal {
        if (msg.value == 0) {
            require(address(this).balance >= fee, "Fee: unfunded");
            return;
        }
        require(msg.value >= fee, "Fee: insufficient");
        if (msg.value > fee) {
            // slither-disable-next-line low-level-calls
            (bool ok, ) = msg.sender.call{ value: msg.value - fee }("");
            require(ok, "Fee: refund failed");
        }
    }
}
