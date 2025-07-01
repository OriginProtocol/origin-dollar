// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMaverickV2Pool } from "../interfaces/plume/IMaverickV2Pool.sol";

contract MockMaverickDistributor {
    IERC20 public immutable rewardToken;

    uint256 public lastEpoch;
    uint256 public rewardAmount;

    constructor(address _rewardToken) {
        rewardToken = IERC20(_rewardToken);
    }

    function setLastEpoch(uint256 _epoch) external {
        lastEpoch = _epoch;
    }

    function setRewardTokenAmount(uint256 _amount) external {
        rewardAmount = _amount;
    }

    function claimLp(
        address recipient,
        uint256,
        IMaverickV2Pool,
        uint32[] memory,
        uint256
    ) external returns (uint256 amount) {
        rewardToken.transfer(recipient, rewardAmount);
        return rewardAmount;
    }
}
