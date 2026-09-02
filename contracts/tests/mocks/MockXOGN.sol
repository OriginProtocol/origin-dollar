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

    /// @notice Mirrors production's `if (supply > 0)` guard. When there are no
    ///         stakers, `ExponentialStaking._collectRewards` skips the pull
    ///         entirely -- no revert, so nothing for a try/catch to see.
    bool public supplyIsZero;

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

    function setSupplyIsZero(bool _isZero) external {
        supplyIsZero = _isZero;
    }

    function collectRewards() external {
        if (address(rewardsSource) != address(0)) {
            // Production skips the pull outright while there are no stakers, and
            // otherwise wraps it in try/catch so staking keeps working when
            // rewards fail. Both paths leave `lastCollect` untouched without
            // reverting, which is exactly what the module has to detect.
            if (!supplyIsZero && !collectReverts) {
                try rewardsSource.collectRewards() {} catch {}
            }
            return;
        }

        if (rewardAmount > 0) {
            ogn.mint(msg.sender, rewardAmount);
        }
    }
}
