// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Project imports
import {ICollectXOGNRewardsModule} from "contracts/interfaces/automation/ICollectXOGNRewardsModule.sol";

abstract contract Smoke_CollectXOGNRewardsModule_Shared_Test is BaseSmoke {
    ICollectXOGNRewardsModule internal collectXOGNRewardsModule;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        collectXOGNRewardsModule = ICollectXOGNRewardsModule(payable(resolver.resolve("COLLECT_XOGN_REWARDS_MODULE")));
        vm.label(address(collectXOGNRewardsModule), "CollectXOGNRewardsModule");
    }
}
