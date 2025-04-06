// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGauge {
    function owner() external view returns (address);

    function TOKEN() external view returns (address);

    function DISTRIBUTION() external view returns (address);

    function balanceOf(address account) external view returns (uint256);

    function claimFees() external returns (uint256 claimed0, uint256 claimed1);

    function deposit(uint256 amount) external;

    function depositAll() external;

    function earned(address account) external view returns (uint256);

    function getReward() external;

    function getReward(address _user) external;

    function isForPair() external view returns (bool);

    function lastTimeRewardApplicable() external view returns (uint256);

    function lastUpdateTime() external view returns (uint256);

    function notifyRewardAmount(address token, uint256 reward) external;

    function periodFinish() external view returns (uint256);

    function rewardForDuration() external view returns (uint256);

    function rewardPerToken() external view returns (uint256);

    function rewardPerTokenStored() external view returns (uint256);

    function rewardRate() external view returns (uint256);

    function rewardToken() external view returns (address);

    function rewards(address) external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function userRewardPerTokenPaid(address) external view returns (uint256);

    function withdraw(uint256 amount) external;

    function withdrawAll() external;

    function withdrawAllAndHarvest() external;

    function withdrawExcess(address token, uint256 amount) external;

    function emergency() external returns (bool);

    function emergencyWithdraw() external;

    function activateEmergencyMode() external;

    function stopEmergencyMode() external;
}
