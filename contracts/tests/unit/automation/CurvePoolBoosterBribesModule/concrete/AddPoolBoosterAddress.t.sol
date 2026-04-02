// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CurvePoolBoosterBribesModule_Shared_Test
} from "tests/unit/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol";
import {ICurvePoolBoosterBribesModule} from "contracts/interfaces/automation/ICurvePoolBoosterBribesModule.sol";

contract Unit_Concrete_CurvePoolBoosterBribesModule_AddPoolBoosterAddress_Test is
    Unit_CurvePoolBoosterBribesModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- ADD POOL BOOSTER ADDRESS
    //////////////////////////////////////////////////////

    function test_addPoolBoosterAddress_addsAndEmitsEvent() public {
        address newBooster = makeAddr("PoolBooster3");

        address[] memory boosters = new address[](1);
        boosters[0] = newBooster;

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBoosterBribesModule.PoolBoosterAddressAdded(newBooster);
        curvePoolBoosterBribesModule.addPoolBoosterAddress(boosters);

        address[] memory allBoosters = curvePoolBoosterBribesModule.getPoolBoosters();
        assertEq(allBoosters.length, 3);
        assertEq(allBoosters[2], newBooster);
    }

    function test_addPoolBoosterAddress_RevertWhen_duplicate() public {
        address[] memory boosters = new address[](1);
        boosters[0] = poolBooster1;

        vm.prank(operator);
        vm.expectRevert("Pool already added");
        curvePoolBoosterBribesModule.addPoolBoosterAddress(boosters);
    }

    function test_addPoolBoosterAddress_RevertWhen_zeroAddress() public {
        address[] memory boosters = new address[](1);
        boosters[0] = address(0);

        vm.prank(operator);
        vm.expectRevert("Zero address");
        curvePoolBoosterBribesModule.addPoolBoosterAddress(boosters);
    }

    function test_addPoolBoosterAddress_RevertWhen_notOperator() public {
        address[] memory boosters = new address[](1);
        boosters[0] = makeAddr("PoolBooster3");

        vm.prank(josh);
        vm.expectRevert();
        curvePoolBoosterBribesModule.addPoolBoosterAddress(boosters);
    }
}
