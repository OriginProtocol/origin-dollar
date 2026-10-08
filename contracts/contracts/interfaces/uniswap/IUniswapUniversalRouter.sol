// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUniswapUniversalRouter {
    /// @notice Executes encoded commands along with provided inputs. Reverts if deadline has expired.
    /// @param commands A set of concatenated commands, each 1 byte in length
    /// @param inputs An array of byte strings containing abi encoded inputs for each command
    /// @param deadline The deadline by which the transaction must be executed
    function execute(
        bytes calldata commands,
        bytes[] calldata inputs,
        uint256 deadline
    ) external payable;

    function execute(bytes calldata commands, bytes[] calldata inputs)
        external
        payable;
}
