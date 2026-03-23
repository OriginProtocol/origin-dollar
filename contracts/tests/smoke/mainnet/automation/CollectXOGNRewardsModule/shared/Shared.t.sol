// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {CollectXOGNRewardsModule} from "contracts/automation/CollectXOGNRewardsModule.sol";

abstract contract Smoke_CollectXOGNRewardsModule_Shared_Test is BaseSmoke {
    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        collectXOGNRewardsModule = CollectXOGNRewardsModule(payable(resolver.resolve("COLLECT_XOGN_REWARDS_MODULE")));
        vm.label(address(collectXOGNRewardsModule), "CollectXOGNRewardsModule");
    }
}
