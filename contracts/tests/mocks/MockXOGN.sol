// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

/// @notice Mock xOGN that distributes OGN rewards on collectRewards().
contract MockXOGN {
    MockERC20 public ogn;
    uint256 public rewardAmount;

    constructor(address _ogn) {
        ogn = MockERC20(_ogn);
    }

    function setRewardAmount(uint256 _amount) external {
        rewardAmount = _amount;
    }

    function collectRewards() external {
        if (rewardAmount > 0) {
            ogn.mint(msg.sender, rewardAmount);
        }
    }
}
