// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";

interface IPoolBoosterMerkl is IPoolBooster {
    function initialize(
        uint32 _duration,
        uint32 _campaignType,
        address _rewardToken,
        address _merklDistributor,
        address _governor,
        address _strategist,
        bytes calldata _campaignData
    ) external;

    function merklDistributor() external view returns (address);

    function rewardToken() external view returns (address);

    function duration() external view returns (uint32);

    function campaignType() external view returns (uint32);

    function campaignData() external view returns (bytes memory);

    function MIN_BRIBE_AMOUNT() external view returns (uint256);

    function getNextPeriodStartTime() external view returns (uint32);
}
