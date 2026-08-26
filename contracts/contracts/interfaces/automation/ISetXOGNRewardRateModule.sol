// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface ISetXOGNRewardRateModule is IAbstractSafeModule {
    event RewardRateSet(uint192 newRate, uint256 available);
    event BoundsSet(
        uint192 minRate,
        uint192 maxRate,
        uint16 maxStepBps,
        uint256 minRunway
    );

    function rewardsSource() external view returns (address);

    function ogn() external view returns (address);

    function xogn() external view returns (address);

    function minRate() external view returns (uint192);

    function maxRate() external view returns (uint192);

    function maxStepBps() external view returns (uint16);

    function minRunway() external view returns (uint256);

    function setRewardRate(uint192 newRate) external;

    function setBounds(
        uint192 minRate,
        uint192 maxRate,
        uint16 maxStepBps,
        uint256 minRunway
    ) external;
}
