// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CurvePoolBoosterBribesModule_Shared_Test
} from "tests/unit/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol";

contract Unit_Concrete_CurvePoolBoosterBribesModule_Constructor_Test is Unit_CurvePoolBoosterBribesModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    //////////////////////////////////////////////////////

    function test_constructor_poolBoostersStored() public view {
        address[] memory boosters = curvePoolBoosterBribesModule.getPoolBoosters();
        assertEq(boosters.length, 2);
        assertEq(boosters[0], poolBooster1);
        assertEq(boosters[1], poolBooster2);
    }

    function test_constructor_bridgeFeeSet() public view {
        assertEq(curvePoolBoosterBribesModule.bridgeFee(), 0.001 ether);
    }

    function test_constructor_additionalGasLimitSet() public view {
        assertEq(curvePoolBoosterBribesModule.additionalGasLimit(), 200_000);
    }

    function test_constructor_operatorRoleGranted() public view {
        assertTrue(curvePoolBoosterBribesModule.hasRole(curvePoolBoosterBribesModule.OPERATOR_ROLE(), operator));
    }

    function test_constructor_safeHasAdminRole() public view {
        assertTrue(
            curvePoolBoosterBribesModule.hasRole(curvePoolBoosterBribesModule.DEFAULT_ADMIN_ROLE(), address(mockSafe))
        );
    }
}
