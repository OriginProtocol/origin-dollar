// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSwapXGauge {
    mapping(address => uint256) public _staked;
    address public _lpToken;
    address public _rewardToken;
    bool public _emergency;
    mapping(address => uint256) public _rewards;

    constructor(address lpToken_, address rewardToken_) {
        _lpToken = lpToken_;
        _rewardToken = rewardToken_;
    }

    function TOKEN() external view returns (address) {
        return _lpToken;
    }

    function deposit(uint256 amount) external {
        IERC20(_lpToken).transferFrom(msg.sender, address(this), amount);
        _staked[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        _staked[msg.sender] -= amount;
        IERC20(_lpToken).transfer(msg.sender, amount);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _staked[account];
    }

    function getReward() external {
        uint256 reward = _rewards[msg.sender];
        if (reward > 0) {
            _rewards[msg.sender] = 0;
            IERC20(_rewardToken).transfer(msg.sender, reward);
        }
    }

    function emergency() external view returns (bool) {
        return _emergency;
    }

    function emergencyWithdraw() external {
        uint256 amount = _staked[msg.sender];
        _staked[msg.sender] = 0;
        IERC20(_lpToken).transfer(msg.sender, amount);
    }

    function activateEmergencyMode() external {
        _emergency = true;
    }

    // Test setter
    function setRewardAmount(address account, uint256 amount) external {
        _rewards[account] = amount;
    }
}
