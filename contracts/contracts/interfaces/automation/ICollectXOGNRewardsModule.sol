// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface ICollectXOGNRewardsModule is IAbstractSafeModule {
    function xogn() external view returns (address);

    function rewardsSource() external view returns (address);

    function ogn() external view returns (address);

    function collectRewards() external;
}
