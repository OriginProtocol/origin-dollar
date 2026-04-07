// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {ICurvePoolBooster} from "contracts/interfaces/poolBooster/ICurvePoolBooster.sol";

contract Unit_Concrete_CurvePoolBooster_SetCampaignRemoteManager_Test is Unit_Curve_Shared_Test {
    function test_setCampaignRemoteManager() public {
        vm.prank(governor);
        curvePoolBoosterPlain.setCampaignRemoteManager(alice);

        assertEq(curvePoolBoosterPlain.campaignRemoteManager(), alice);
    }

    function test_setCampaignRemoteManager_event() public {
        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.CampaignRemoteManagerUpdated(alice);

        vm.prank(governor);
        curvePoolBoosterPlain.setCampaignRemoteManager(alice);
    }

    function test_setCampaignRemoteManager_RevertWhen_zeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Invalid campaignRemoteManager");
        curvePoolBoosterPlain.setCampaignRemoteManager(address(0));
    }

    function test_setCampaignRemoteManager_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        curvePoolBoosterPlain.setCampaignRemoteManager(alice);
    }
}
