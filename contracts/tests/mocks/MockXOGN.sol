// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockFixedRateRewardsSource} from "tests/mocks/MockFixedRateRewardsSource.sol";

/// @notice Mock xOGN that distributes OGN rewards on collectRewards().
contract MockXOGN {
    MockERC20 public ogn;
    uint256 public rewardAmount;

    /// @notice Optional reward source. When set, `collectRewards()` pulls from it
    ///         the way `ExponentialStaking._collectRewards` does.
    MockFixedRateRewardsSource public rewardsSource;

    /// @notice Makes the pull revert, to exercise the try/catch in production.
    bool public collectReverts;

    constructor(address _ogn) {
        ogn = MockERC20(_ogn);
    }

    function setRewardAmount(uint256 _amount) external {
        rewardAmount = _amount;
    }

    function setRewardsSource(address _source) external {
        rewardsSource = MockFixedRateRewardsSource(_source);
    }

    function setCollectReverts(bool _reverts) external {
        collectReverts = _reverts;
    }

    function collectRewards() external {
        if (address(rewardsSource) != address(0)) {
            // Production wraps this in try/catch so staking keeps working when
            // rewards fail. The module must stay correct when it silently no-ops.
            if (!collectReverts) {
                try rewardsSource.collectRewards() {} catch {}
            }
            return;
        }

        if (rewardAmount > 0) {
            ogn.mint(msg.sender, rewardAmount);
        }
    }
}
