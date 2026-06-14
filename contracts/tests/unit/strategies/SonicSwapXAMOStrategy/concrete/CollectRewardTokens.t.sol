// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_CollectRewardTokens_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_collectRewardTokens_claimsFromGauge() public {
        uint256 rewardAmount = 5 ether;
        // Set reward amount on gauge for the strategy
        mockSwapXGauge.setRewardAmount(address(sonicSwapXAMOStrategy), rewardAmount);
        // Deal SWPx tokens to gauge so it can transfer
        deal(address(swpxToken), address(mockSwapXGauge), rewardAmount);

        vm.prank(harvester);
        sonicSwapXAMOStrategy.collectRewardTokens();

        // SWPx should be transferred to harvester
        assertEq(swpxToken.balanceOf(harvester), rewardAmount);
        assertEq(swpxToken.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_collectRewardTokens_transfersToHarvester() public {
        uint256 rewardAmount = 10 ether;
        mockSwapXGauge.setRewardAmount(address(sonicSwapXAMOStrategy), rewardAmount);
        deal(address(swpxToken), address(mockSwapXGauge), rewardAmount);

        vm.prank(harvester);
        sonicSwapXAMOStrategy.collectRewardTokens();

        assertEq(swpxToken.balanceOf(harvester), rewardAmount);
    }

    function test_collectRewardTokens_RevertWhen_calledByNonHarvester() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Harvester or Strategist");
        sonicSwapXAMOStrategy.collectRewardTokens();
    }
}
