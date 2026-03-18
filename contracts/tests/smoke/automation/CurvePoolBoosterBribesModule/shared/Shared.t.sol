// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {CurvePoolBoosterBribesModule} from "contracts/automation/CurvePoolBoosterBribesModule.sol";

abstract contract Smoke_CurvePoolBoosterBribesModule_Shared_Test is BaseSmoke {
    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        curvePoolBoosterBribesModule =
            CurvePoolBoosterBribesModule(payable(resolver.resolve("CURVE_POOL_BOOSTER_BRIBES_MODULE")));
        vm.label(address(curvePoolBoosterBribesModule), "CurvePoolBoosterBribesModule");
    }
}
