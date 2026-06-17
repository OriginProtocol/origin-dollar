// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Project imports
import {ICurvePoolBoosterBribesModule} from "contracts/interfaces/automation/ICurvePoolBoosterBribesModule.sol";

abstract contract Smoke_CurvePoolBoosterBribesModule_Shared_Test is BaseSmoke {
    ICurvePoolBoosterBribesModule internal curvePoolBoosterBribesModule;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        curvePoolBoosterBribesModule =
            ICurvePoolBoosterBribesModule(payable(resolver.resolve("CURVE_POOL_BOOSTER_BRIBES_MODULE")));
        vm.label(address(curvePoolBoosterBribesModule), "CurvePoolBoosterBribesModule");
    }
}
