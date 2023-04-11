// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { MockStkAave } from "./MockStkAave.sol";

contract MockAaveIncentivesController {
    mapping(address => uint256) private rewards;
    MockStkAave public REWARD_TOKEN;

    constructor(address _reward_token) {
        REWARD_TOKEN = MockStkAave(_reward_token);
    }

    function setRewardsBalance(address user, uint256 amount) external {
        rewards[user] = amount;
    }

    /**
     * @dev Returns the total of rewards of an user, already accrued + not yet accrued
     * @param user The address of the user
     * @return The rewards
     **/
    // solhint-disable-next-line no-unused-vars
    function getRewardsBalance(address[] calldata assets, address user)
        external
        view
        returns (uint256)
    {
        return rewards[user];
    }

    /**
     * @dev Claims reward for an user, on all the assets of the lending pool, accumulating the pending rewards
     * @param amount Amount of rewards to claim
     * @param to Address that will be receiving the rewards
     * @return Rewards claimed
     **/
    function claimRewards(
        // solhint-disable-next-line no-unused-vars
        address[] calldata assets,
        uint256 amount,
        address to
    ) external returns (uint256) {
        require(amount > 0);
        require(rewards[to] == amount);
        REWARD_TOKEN.mint(amount);
        require(REWARD_TOKEN.transfer(to, amount));
        // solhint-disable-next-line reentrancy
        rewards[to] = 0;
        return amount;
    }
}
