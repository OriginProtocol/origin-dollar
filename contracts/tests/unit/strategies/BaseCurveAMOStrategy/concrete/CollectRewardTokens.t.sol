// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_CollectRewardTokens_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_collectRewardTokens_callsGaugeFactoryAndGauge() public {
        // Simulate CRV rewards in the strategy
        crvToken.mint(address(baseCurveAMOStrategy), 5 ether);

        vm.prank(harvester);
        baseCurveAMOStrategy.collectRewardTokens();

        // CRV should be transferred to harvester
        assertEq(crvToken.balanceOf(harvester), 5 ether);
        assertEq(crvToken.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_collectRewardTokens_transfersToHarvester() public {
        uint256 rewardAmount = 10 ether;
        crvToken.mint(address(baseCurveAMOStrategy), rewardAmount);

        vm.prank(harvester);
        baseCurveAMOStrategy.collectRewardTokens();

        assertEq(crvToken.balanceOf(harvester), rewardAmount);
    }

    function test_collectRewardTokens_RevertWhen_calledByNonHarvester() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Harvester");
        baseCurveAMOStrategy.collectRewardTokens();
    }

    function test_collectRewardTokens_noOpWhenNoRewards() public {
        vm.prank(harvester);
        baseCurveAMOStrategy.collectRewardTokens();

        assertEq(crvToken.balanceOf(harvester), 0);
    }

    function test_collectRewardTokens_RevertWhen_calledByStrategist() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Harvester");
        baseCurveAMOStrategy.collectRewardTokens();
    }

    function test_collectRewardTokens_RevertWhen_calledByGovernor() public {
        vm.prank(governor);
        vm.expectRevert("Caller is not the Harvester");
        baseCurveAMOStrategy.collectRewardTokens();
    }
}
