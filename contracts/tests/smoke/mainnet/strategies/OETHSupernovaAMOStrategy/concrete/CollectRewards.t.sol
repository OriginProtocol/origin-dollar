// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHSupernovaAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_OETHSupernovaAMOStrategy_CollectRewards_Test is Smoke_OETHSupernovaAMOStrategy_Shared_Test {
    function test_collectRewardTokens_doesNotRevert() public {
        address harvester = oethSupernovaAMOStrategy.harvesterAddress();
        vm.prank(harvester);
        oethSupernovaAMOStrategy.collectRewardTokens();
    }
}
