// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_OETHCurveAMOStrategy_CollectRewards_Test is Smoke_OETHCurveAMOStrategy_Shared_Test {
    function test_collectRewardTokens_doesNotRevert() public {
        address harvester = curveAMOStrategy.harvesterAddress();
        vm.prank(harvester);
        curveAMOStrategy.collectRewardTokens();
    }

    function test_rewardTokenAddresses_isConfigured() public view {
        address[] memory rewards = curveAMOStrategy.getRewardTokenAddresses();
        assertGt(rewards.length, 0, "Should have at least one reward token configured");
    }
}
