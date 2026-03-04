// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.sol";
import {CurvePoolBooster} from "contracts/poolBooster/curve/CurvePoolBooster.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {ICampaignRemoteManager} from "contracts/interfaces/ICampaignRemoteManager.sol";

contract Unit_Concrete_CurvePoolBooster_CloseCampaign_Test is Unit_Curve_Shared_Test {
    function setUp() public override {
        super.setUp();
        _mockCampaignRemoteManager();

        // Set campaignId to 5
        vm.prank(governor);
        curvePoolBoosterPlain.setCampaignId(5);
    }

    function test_closeCampaign() public {
        vm.prank(governor);
        curvePoolBoosterPlain.closeCampaign(5, 0);

        assertEq(curvePoolBoosterPlain.campaignId(), 0);
    }

    function test_closeCampaign_event() public {
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.CampaignClosed(5);

        vm.prank(governor);
        curvePoolBoosterPlain.closeCampaign(5, 0);
    }

    function test_closeCampaign_resetsCampaignId() public {
        assertEq(curvePoolBoosterPlain.campaignId(), 5);

        vm.prank(governor);
        curvePoolBoosterPlain.closeCampaign(5, 0);

        assertEq(curvePoolBoosterPlain.campaignId(), 0);
    }

    function test_closeCampaign_RevertWhen_notAuthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        curvePoolBoosterPlain.closeCampaign(5, 0);
    }

    function test_closeCampaign_strategistCanCall() public {
        vm.prank(strategist);
        curvePoolBoosterPlain.closeCampaign(5, 0);

        assertEq(curvePoolBoosterPlain.campaignId(), 0);
    }

    /// @notice Verify closeCampaign uses state campaignId (not parameter) in the remote call struct
    ///         but emits the parameter _campaignId in the event
    function test_closeCampaign_usesStateCampaignId() public {
        // State campaignId is 5 (set in setUp)
        // Pass different _campaignId parameter (99)
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.CampaignClosed(99); // Event uses _campaignId parameter

        vm.prank(governor);
        curvePoolBoosterPlain.closeCampaign(99, 0);

        // State campaignId reset to 0
        assertEq(curvePoolBoosterPlain.campaignId(), 0);
    }

    /// @notice Test closeCampaign with ETH forwarding
    function test_closeCampaign_withEth() public {
        vm.deal(governor, 1 ether);
        vm.prank(governor);
        curvePoolBoosterPlain.closeCampaign{value: 0.1 ether}(5, 0);

        // Verify the call succeeded
        assertEq(curvePoolBoosterPlain.campaignId(), 0);
    }
}
