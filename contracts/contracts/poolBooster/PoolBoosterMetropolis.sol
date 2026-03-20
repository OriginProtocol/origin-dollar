// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IPoolBooster } from "../interfaces/poolBooster/IPoolBooster.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Pool booster for Metropolis pools
 * @author Origin Protocol Inc
 */
contract PoolBoosterMetropolis is IPoolBooster {
    // @notice address of the OS token
    IERC20 public immutable osToken;
    // @notice address of the pool
    address public immutable pool;
    // @notice if balance under this amount the bribe action is skipped
    uint256 public constant MIN_BRIBE_AMOUNT = 1e10;

    IRewarderFactory public immutable rewardFactory;

    IVoter public immutable voter;

    constructor(
        address _osToken,
        address _rewardFactory,
        address _pool,
        address _voter
    ) {
        require(_pool != address(0), "Invalid pool address");
        pool = _pool;
        // Abstract factory already validates this is not a zero address
        osToken = IERC20(_osToken);

        rewardFactory = IRewarderFactory(_rewardFactory);

        voter = IVoter(_voter);
    }

    function bribe() external override {
        uint256 balance = osToken.balanceOf(address(this));
        // balance too small, do no bribes
        (, uint256 minBribeAmount) = rewardFactory.getWhitelistedTokenInfo(
            address(osToken)
        );
        if (balance < MIN_BRIBE_AMOUNT || balance < minBribeAmount) {
            return;
        }

        uint256 id = voter.getCurrentVotingPeriod() + 1;

        // Deploy a rewarder
        IRewarder rewarder = IRewarder(
            rewardFactory.createBribeRewarder(address(osToken), pool)
        );

        // Approve the rewarder to spend the balance
        osToken.approve(address(rewarder), balance);

        // Fund and bribe the rewarder
        rewarder.fundAndBribe(id, id, balance);

        emit BribeExecuted(balance);
    }
}

interface IRewarderFactory {
    function createBribeRewarder(address token, address pool)
        external
        returns (address rewarder);

    function getWhitelistedTokenInfo(address token)
        external
        view
        returns (bool isWhitelisted, uint256 minBribeAmount);
}

interface IRewarder {
    function fundAndBribe(
        uint256 startId,
        uint256 lastId,
        uint256 amountPerPeriod
    ) external payable;
}

interface IVoter {
    function getCurrentVotingPeriod() external view returns (uint256);
}
