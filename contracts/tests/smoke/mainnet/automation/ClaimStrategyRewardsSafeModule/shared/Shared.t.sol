// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {IClaimStrategyRewardsSafeModule} from "contracts/interfaces/automation/IClaimStrategyRewardsSafeModule.sol";

abstract contract Smoke_ClaimStrategyRewardsSafeModule_Shared_Test is BaseSmoke {
    IClaimStrategyRewardsSafeModule internal claimStrategyRewardsModule;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        claimStrategyRewardsModule =
            IClaimStrategyRewardsSafeModule(payable(resolver.resolve("CLAIM_STRATEGY_REWARDS_MODULE")));
        vm.label(address(claimStrategyRewardsModule), "ClaimStrategyRewardsSafeModule");
    }
}
