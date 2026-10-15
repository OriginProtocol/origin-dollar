// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @notice Minimal subset of Uniswap's Permit2 `AllowanceTransfer`.
interface IPermit2 {
    /// @dev An `expiration` of 0 means the allowance expires at the end of the
    ///      current block.
    function approve(
        address token,
        address spender,
        uint160 amount,
        uint48 expiration
    ) external;

    function allowance(
        address user,
        address token,
        address spender
    )
        external
        view
        returns (
            uint160 amount,
            uint48 expiration,
            uint48 nonce
        );
}
