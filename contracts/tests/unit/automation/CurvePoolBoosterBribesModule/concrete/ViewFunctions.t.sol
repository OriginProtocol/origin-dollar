// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CurvePoolBoosterBribesModule_Shared_Test
} from "tests/unit/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol";

contract Unit_Concrete_CurvePoolBoosterBribesModule_ViewFunctions_Test is
    Unit_CurvePoolBoosterBribesModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_getPoolBoosters_returnsCorrectArray() public view {
        address[] memory boosters = curvePoolBoosterBribesModule.getPoolBoosters();
        assertEq(boosters.length, 2);
        assertEq(boosters[0], poolBooster1);
        assertEq(boosters[1], poolBooster2);
    }

    function test_poolBoosters_accessByIndex() public view {
        assertEq(curvePoolBoosterBribesModule.poolBoosters(0), poolBooster1);
        assertEq(curvePoolBoosterBribesModule.poolBoosters(1), poolBooster2);
    }
}
