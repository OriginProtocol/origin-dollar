// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {CurvePoolBoosterFactory} from "contracts/poolBooster/curve/CurvePoolBoosterFactory.sol";

contract Unit_Concrete_CurvePoolBoosterFactory_ViewFunctions_Test is Unit_Curve_Shared_Test {
    function test_poolBoosterLength() public view {
        assertEq(curvePoolBoosterFactory.poolBoosterLength(), 0);
    }

    function test_getPoolBoosters() public view {
        CurvePoolBoosterFactory.PoolBoosterEntry[] memory entries = curvePoolBoosterFactory.getPoolBoosters();
        assertEq(entries.length, 0);
    }
}
