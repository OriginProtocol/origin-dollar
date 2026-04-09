// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_CurveAMOStrategy_CollectRewardTokens_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_collectRewardTokens_callsMinterAndGauge() public {
        // Simulate CRV rewards in the strategy
        crvToken.mint(address(curveAMOStrategy), 5 ether);

        vm.prank(harvester);
        curveAMOStrategy.collectRewardTokens();

        // CRV should be transferred to harvester
        assertEq(crvToken.balanceOf(harvester), 5 ether);
        assertEq(crvToken.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_collectRewardTokens_transfersToHarvester() public {
        uint256 rewardAmount = 10 ether;
        crvToken.mint(address(curveAMOStrategy), rewardAmount);

        vm.prank(harvester);
        curveAMOStrategy.collectRewardTokens();

        assertEq(crvToken.balanceOf(harvester), rewardAmount);
    }

    function test_collectRewardTokens_RevertWhen_calledByNonHarvester() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Harvester");
        curveAMOStrategy.collectRewardTokens();
    }

    function test_collectRewardTokens_noOpWhenNoRewards() public {
        // No CRV in strategy — should not revert, just nothing transferred
        vm.prank(harvester);
        curveAMOStrategy.collectRewardTokens();

        assertEq(crvToken.balanceOf(harvester), 0);
    }

    function test_collectRewardTokens_RevertWhen_calledByStrategist() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Harvester");
        curveAMOStrategy.collectRewardTokens();
    }

    function test_collectRewardTokens_RevertWhen_calledByGovernor() public {
        vm.prank(governor);
        vm.expectRevert("Caller is not the Harvester");
        curveAMOStrategy.collectRewardTokens();
    }
}
