// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IPoolBooster {
    event BribeExecuted(uint256 amount);

    /// @notice Execute the bribe action
    function bribe() external;
}
