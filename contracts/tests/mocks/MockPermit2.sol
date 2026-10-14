// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockPermit2
/// @notice Permit2 `AllowanceTransfer` with the real semantics the rebalance module relies on:
///         allowances decrement on use, an expiration of 0 means "this block", and the pull goes
///         through the token's own `transferFrom`, so the token allowance to Permit2 runs down too.
contract MockPermit2 {
    struct Allowance {
        uint160 amount;
        uint48 expiration;
    }

    mapping(address => mapping(address => mapping(address => Allowance))) internal allowances;

    function approve(address token, address spender, uint160 amount, uint48 expiration) external {
        allowances[msg.sender][token][spender] =
            Allowance({amount: amount, expiration: expiration == 0 ? uint48(block.timestamp) : expiration});
    }

    function allowance(address user, address token, address spender)
        external
        view
        returns (uint160 amount, uint48 expiration, uint48 nonce)
    {
        Allowance memory a = allowances[user][token][spender];
        return (a.amount, a.expiration, 0);
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        Allowance storage a = allowances[from][token][msg.sender];
        require(block.timestamp <= a.expiration, "AllowanceExpired");
        require(a.amount >= amount, "InsufficientAllowance");
        a.amount -= amount;
        require(IERC20(token).transferFrom(from, to, amount), "Transfer failed");
    }
}
