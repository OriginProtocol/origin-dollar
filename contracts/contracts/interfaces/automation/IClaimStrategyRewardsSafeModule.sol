// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IAbstractSafeModule} from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface IClaimStrategyRewardsSafeModule is IAbstractSafeModule {
    event StrategyAdded(address strategy);
    event StrategyRemoved(address strategy);
    event ClaimRewardsFailed(address strategy);

    function isStrategyWhitelisted(address strategy) external view returns (bool);

    function strategies(uint256 index) external view returns (address);

    function claimRewards(bool silent) external;

    function addStrategy(address _strategy) external;

    function removeStrategy(address _strategy) external;
}
