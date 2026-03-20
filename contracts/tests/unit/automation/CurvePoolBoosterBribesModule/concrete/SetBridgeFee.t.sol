// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurvePoolBoosterBribesModule_Shared_Test} from
    "tests/unit/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol";

import {CurvePoolBoosterBribesModule} from "contracts/automation/CurvePoolBoosterBribesModule.sol";

contract Unit_Concrete_CurvePoolBoosterBribesModule_SetBridgeFee_Test
    is Unit_CurvePoolBoosterBribesModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- SET BRIDGE FEE
    //////////////////////////////////////////////////////

    function test_setBridgeFee_updatesAndEmitsEvent() public {
        uint256 newFee = 0.005 ether;

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBoosterBribesModule.BridgeFeeUpdated(newFee);
        curvePoolBoosterBribesModule.setBridgeFee(newFee);

        assertEq(curvePoolBoosterBribesModule.bridgeFee(), newFee);
    }

    function test_setBridgeFee_RevertWhen_tooHigh() public {
        vm.prank(operator);
        vm.expectRevert("Bridge fee too high");
        curvePoolBoosterBribesModule.setBridgeFee(0.01 ether + 1);
    }

    function test_setBridgeFee_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert();
        curvePoolBoosterBribesModule.setBridgeFee(0.005 ether);
    }
}
