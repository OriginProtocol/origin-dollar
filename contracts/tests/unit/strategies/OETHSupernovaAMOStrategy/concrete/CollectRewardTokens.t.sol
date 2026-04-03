// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_CollectRewardTokens_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    function test_collectRewardTokens_claimsFromGauge() public {
        uint256 rewardAmount = 5 ether;
        // Set reward amount on gauge for the strategy
        mockSwapXGauge.setRewardAmount(address(oethSupernovaAMOStrategy), rewardAmount);
        // Deal reward tokens to gauge so it can transfer
        deal(address(swpxToken), address(mockSwapXGauge), rewardAmount);

        vm.prank(harvester);
        oethSupernovaAMOStrategy.collectRewardTokens();

        // Reward tokens should be transferred to harvester
        assertEq(swpxToken.balanceOf(harvester), rewardAmount);
        assertEq(swpxToken.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_collectRewardTokens_transfersToHarvester() public {
        uint256 rewardAmount = 10 ether;
        mockSwapXGauge.setRewardAmount(address(oethSupernovaAMOStrategy), rewardAmount);
        deal(address(swpxToken), address(mockSwapXGauge), rewardAmount);

        vm.prank(harvester);
        oethSupernovaAMOStrategy.collectRewardTokens();

        assertEq(swpxToken.balanceOf(harvester), rewardAmount);
    }

    function test_collectRewardTokens_RevertWhen_calledByNonHarvester() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Harvester");
        oethSupernovaAMOStrategy.collectRewardTokens();
    }
}
