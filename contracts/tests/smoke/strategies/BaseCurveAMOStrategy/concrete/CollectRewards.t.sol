// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_BaseCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_BaseCurveAMOStrategy_CollectRewards_Test is Smoke_BaseCurveAMOStrategy_Shared_Test {
    function test_collectRewardTokens_doesNotRevert() public {
        address harvester = baseCurveAMOStrategy.harvesterAddress();
        vm.prank(harvester);
        baseCurveAMOStrategy.collectRewardTokens();
    }

    function test_rewardTokenAddresses_isConfigured() public view {
        address[] memory rewards = baseCurveAMOStrategy.getRewardTokenAddresses();
        assertGt(rewards.length, 0, "Should have at least one reward token configured");
    }
}
