// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBribe {
    /// @notice Notify a bribe amount
    /// @dev    Rewards are saved into NEXT EPOCH mapping.
    function notifyRewardAmount(address _rewardsToken, uint256 reward) external;
}
