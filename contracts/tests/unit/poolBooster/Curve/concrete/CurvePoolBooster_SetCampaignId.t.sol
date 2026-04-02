// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {ICurvePoolBooster} from "contracts/interfaces/poolBooster/ICurvePoolBooster.sol";

contract Unit_Concrete_CurvePoolBooster_SetCampaignId_Test is Unit_Curve_Shared_Test {
    function test_setCampaignId() public {
        vm.prank(governor);
        curvePoolBoosterPlain.setCampaignId(42);

        assertEq(curvePoolBoosterPlain.campaignId(), 42);
    }

    function test_setCampaignId_event() public {
        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.CampaignIdUpdated(42);

        vm.prank(governor);
        curvePoolBoosterPlain.setCampaignId(42);
    }

    function test_setCampaignId_strategistCanCall() public {
        vm.prank(strategist);
        curvePoolBoosterPlain.setCampaignId(42);

        assertEq(curvePoolBoosterPlain.campaignId(), 42);
    }

    function test_setCampaignId_RevertWhen_notAuthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        curvePoolBoosterPlain.setCampaignId(42);
    }
}
