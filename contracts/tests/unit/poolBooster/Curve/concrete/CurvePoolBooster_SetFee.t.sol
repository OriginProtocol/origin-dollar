// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {CurvePoolBooster} from "contracts/poolBooster/curve/CurvePoolBooster.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {ICampaignRemoteManager} from "contracts/interfaces/ICampaignRemoteManager.sol";

contract Unit_Concrete_CurvePoolBooster_SetFee_Test is Unit_Curve_Shared_Test {
    function test_setFee() public {
        vm.prank(governor);
        curvePoolBoosterPlain.setFee(2000);

        assertEq(curvePoolBoosterPlain.fee(), 2000);
    }

    function test_setFee_event() public {
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.FeeUpdated(2000);

        vm.prank(governor);
        curvePoolBoosterPlain.setFee(2000);
    }

    function test_setFee_maxAllowed() public {
        vm.prank(governor);
        curvePoolBoosterPlain.setFee(5000);

        assertEq(curvePoolBoosterPlain.fee(), 5000);
    }

    function test_setFee_zero() public {
        vm.prank(governor);
        curvePoolBoosterPlain.setFee(0);

        assertEq(curvePoolBoosterPlain.fee(), 0);
    }

    function test_setFee_RevertWhen_tooHigh() public {
        vm.prank(governor);
        vm.expectRevert("Fee too high");
        curvePoolBoosterPlain.setFee(5001);
    }

    function test_setFee_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        curvePoolBoosterPlain.setFee(2000);
    }
}
