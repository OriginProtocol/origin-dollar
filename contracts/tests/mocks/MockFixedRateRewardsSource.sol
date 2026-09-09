// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

/// @notice Mock of the deployed `FixedRateRewardsSource` (impl 0x16890bdd...).
/// @dev Mirrors production faithfully, including the two behaviours that make
///      the rate-change ordering matter. Do not "fix" these in the mock:
///
///      1. `setRewardsPerSecond` does NOT settle first. It only resets
///         `lastCollect` when the *old* rate was zero. Every other rate change
///         reprices the whole unsettled window retroactively.
///      2. `previewRewards` caps at the balance while `collectRewards` advances
///         `lastCollect` unconditionally, so a shortfall is forfeited rather
///         than carried forward.
///
///      A gentler mock would let SetXOGNRewardRateModule pass its tests without
///      the settle-first call it exists to make.
contract MockFixedRateRewardsSource {
    struct RewardConfig {
        uint64 lastCollect;
        uint192 rewardsPerSecond;
    }

    MockERC20 public rewardToken;
    address public rewardsTarget;
    RewardConfig public rewardConfig;

    constructor(address _rewardToken) {
        rewardToken = MockERC20(_rewardToken);
        rewardConfig.lastCollect = uint64(block.timestamp);
    }

    function setRewardsTarget(address _target) external {
        rewardsTarget = _target;
    }

    function collectRewards() external returns (uint256 rewardAmount) {
        require(msg.sender == rewardsTarget, "UnauthorizedCaller");

        rewardAmount = previewRewards();

        // Advances regardless of whether the balance covered the accrual.
        rewardConfig.lastCollect = uint64(block.timestamp);

        if (rewardAmount > 0) {
            rewardToken.transfer(rewardsTarget, rewardAmount);
        }
    }

    function previewRewards() public view returns (uint256 rewardAmount) {
        RewardConfig memory _config = rewardConfig;
        rewardAmount = (block.timestamp - _config.lastCollect) * _config.rewardsPerSecond;
        uint256 balance = rewardToken.balanceOf(address(this));
        if (rewardAmount > balance) {
            rewardAmount = balance;
        }
    }

    function setRewardsPerSecond(uint192 _rewardsPerSecond) external {
        RewardConfig storage _config = rewardConfig;
        // Only resets the clock when coming from zero — matching production.
        if (_config.rewardsPerSecond == 0) {
            _config.lastCollect = uint64(block.timestamp);
        }
        _config.rewardsPerSecond = _rewardsPerSecond;
    }
}
