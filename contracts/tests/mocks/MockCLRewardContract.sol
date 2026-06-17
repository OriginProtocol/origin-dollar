// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract MockCLRewardContract {
    address[] internal _rewards;

    function setRewards(address[] memory rewards_) external {
        _rewards = rewards_;
    }

    function rewards(uint256 index) external view returns (address) {
        return _rewards[index];
    }

    function rewardsListLength() external view returns (uint256) {
        return _rewards.length;
    }
}
