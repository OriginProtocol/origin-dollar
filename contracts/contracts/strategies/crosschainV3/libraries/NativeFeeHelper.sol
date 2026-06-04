// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title NativeFeeHelper
 * @author Origin Protocol Inc
 *
 * @notice Shared "consume a native bridge fee" helper used by adapters and strategies that pay
 *         their bridge transports in native gas.
 *
 *         Two source paths:
 *           - `msg.value == 0` → pre-funded: the caller's `address(this).balance` covers the
 *             fee. Used by protocol-driven operations where the entry function is non-payable
 *             and an operator tops up the contract via `receive()` ahead of time.
 *           - `msg.value > 0` → user-paid: the caller supplied the fee; any excess refunds to
 *             `msg.sender`.
 *
 *         Reverts when the chosen source doesn't cover `fee`.
 *
 *         This library uses `internal` linkage so it compiles into the calling contract's
 *         bytecode — no separate library deployment needed.
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
