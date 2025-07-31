// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHHarvesterSimple, IERC20, IStrategy, SafeERC20 } from "./OETHHarvesterSimple.sol";

contract SuperOETHHarvester is OETHHarvesterSimple {
    using SafeERC20 for IERC20;

    constructor(address _wrappedNativeToken)
        OETHHarvesterSimple(_wrappedNativeToken)
    {}

    /// @inheritdoc OETHHarvesterSimple
    function _harvestAndTransfer(address _strategy) internal virtual override {
        // Ensure strategy is supported
        require(supportedStrategies[_strategy], "Strategy not supported");

        address receiver = strategistAddr;
        require(receiver != address(0), "Invalid receiver");

        // Harvest rewards
        IStrategy(_strategy).collectRewardTokens();

        // Cache reward tokens
        address[] memory rewardTokens = IStrategy(_strategy)
            .getRewardTokenAddresses();

        uint256 len = rewardTokens.length;
        for (uint256 i = 0; i < len; i++) {
            // Cache balance
            address token = rewardTokens[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                // Transfer everything to the strategist
                IERC20(token).safeTransfer(receiver, balance);
                emit Harvested(_strategy, token, balance, receiver);
            }
        }
    }
}
