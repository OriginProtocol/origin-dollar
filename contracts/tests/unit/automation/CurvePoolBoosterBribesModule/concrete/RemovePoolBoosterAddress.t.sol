// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurvePoolBoosterBribesModule_Shared_Test} from
    "tests/unit/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol";

import {CurvePoolBoosterBribesModule} from "contracts/automation/CurvePoolBoosterBribesModule.sol";

contract Unit_Concrete_CurvePoolBoosterBribesModule_RemovePoolBoosterAddress_Test
    is Unit_CurvePoolBoosterBribesModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- REMOVE POOL BOOSTER ADDRESS
    //////////////////////////////////////////////////////

    function test_removePoolBoosterAddress_removesAndEmitsEvent() public {
        address[] memory boosters = new address[](1);
        boosters[0] = poolBooster1;

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBoosterBribesModule.PoolBoosterAddressRemoved(poolBooster1);
        curvePoolBoosterBribesModule.removePoolBoosterAddress(boosters);

        address[] memory allBoosters = curvePoolBoosterBribesModule.getPoolBoosters();
        assertEq(allBoosters.length, 1);
        // After removal, poolBooster2 should be swapped into position 0
        assertEq(allBoosters[0], poolBooster2);
    }

    function test_removePoolBoosterAddress_RevertWhen_notFound() public {
        address[] memory boosters = new address[](1);
        boosters[0] = makeAddr("NonExistentBooster");

        vm.prank(operator);
        vm.expectRevert("Pool not found");
        curvePoolBoosterBribesModule.removePoolBoosterAddress(boosters);
    }

    function test_removePoolBoosterAddress_RevertWhen_notOperator() public {
        address[] memory boosters = new address[](1);
        boosters[0] = poolBooster1;

        vm.prank(josh);
        vm.expectRevert();
        curvePoolBoosterBribesModule.removePoolBoosterAddress(boosters);
    }
}
