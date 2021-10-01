// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IRewardStaking {
    function stakeFor(address, uint256) external;

    function stake(uint256) external;

    function withdraw(uint256 amount, bool claim) external;

    function withdrawAndUnwrap(uint256 amount, bool claim) external;

    function earned(address account) external view returns (uint256);

    function getReward() external;

    function getReward(address _account, bool _claimExtras) external;

    function extraRewardsLength() external returns (uint256);

    function extraRewards(uint256 _pid) external returns (address);

    function rewardToken() external returns (address);

    function balanceOf(address account) external view returns (uint256);
}
