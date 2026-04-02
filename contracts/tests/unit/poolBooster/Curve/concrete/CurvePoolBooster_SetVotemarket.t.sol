// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {ICurvePoolBooster} from "contracts/interfaces/poolBooster/ICurvePoolBooster.sol";

contract Unit_Concrete_CurvePoolBooster_SetVotemarket_Test is Unit_Curve_Shared_Test {
    function test_setVotemarket() public {
        vm.prank(governor);
        curvePoolBoosterPlain.setVotemarket(alice);

        assertEq(curvePoolBoosterPlain.votemarket(), alice);
    }

    function test_setVotemarket_event() public {
        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.VotemarketUpdated(alice);

        vm.prank(governor);
        curvePoolBoosterPlain.setVotemarket(alice);
    }

    function test_setVotemarket_RevertWhen_zeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Invalid votemarket");
        curvePoolBoosterPlain.setVotemarket(address(0));
    }

    function test_setVotemarket_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        curvePoolBoosterPlain.setVotemarket(alice);
    }
}
