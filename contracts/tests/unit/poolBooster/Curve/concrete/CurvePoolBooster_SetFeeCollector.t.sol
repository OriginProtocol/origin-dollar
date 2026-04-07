// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {ICurvePoolBooster} from "contracts/interfaces/poolBooster/ICurvePoolBooster.sol";

contract Unit_Concrete_CurvePoolBooster_SetFeeCollector_Test is Unit_Curve_Shared_Test {
    function test_setFeeCollector() public {
        vm.prank(governor);
        curvePoolBoosterPlain.setFeeCollector(alice);

        assertEq(curvePoolBoosterPlain.feeCollector(), alice);
    }

    function test_setFeeCollector_event() public {
        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.FeeCollectorUpdated(alice);

        vm.prank(governor);
        curvePoolBoosterPlain.setFeeCollector(alice);
    }

    function test_setFeeCollector_RevertWhen_zeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Invalid fee collector");
        curvePoolBoosterPlain.setFeeCollector(address(0));
    }

    function test_setFeeCollector_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        curvePoolBoosterPlain.setFeeCollector(alice);
    }
}
