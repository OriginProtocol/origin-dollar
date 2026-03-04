// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.sol";
import {CurvePoolBooster} from "contracts/poolBooster/curve/CurvePoolBooster.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {ICampaignRemoteManager} from "contracts/interfaces/ICampaignRemoteManager.sol";

contract Unit_Concrete_CurvePoolBooster_Constructor_Test is Unit_Curve_Shared_Test {
    CurvePoolBooster internal freshBooster;

    function setUp() public override {
        super.setUp();
        freshBooster = new CurvePoolBooster(address(oeth), mockGauge);
    }

    function test_constructor() public view {
        assertEq(freshBooster.rewardToken(), address(oeth));
        assertEq(freshBooster.gauge(), mockGauge);
    }

    function test_constructor_governorZero() public view {
        assertEq(freshBooster.governor(), address(0));
    }

    function test_constructor_constants() public view {
        assertEq(freshBooster.FEE_BASE(), 10000);
        assertEq(freshBooster.targetChainId(), 42161);
    }
}
