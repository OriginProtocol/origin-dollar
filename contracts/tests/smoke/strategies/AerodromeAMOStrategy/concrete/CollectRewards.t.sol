// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_AerodromeAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_AerodromeAMOStrategy_CollectRewards_Test is Smoke_AerodromeAMOStrategy_Shared_Test {
    function test_collectRewardTokens_doesNotRevert() public {
        address harvester = aerodromeAMOStrategy.harvesterAddress();
        vm.prank(harvester);
        aerodromeAMOStrategy.collectRewardTokens();
    }

    function test_collectRewardTokens_RevertWhen_notHarvester() public {
        vm.expectRevert("Caller is not the Harvester");
        aerodromeAMOStrategy.collectRewardTokens();
    }
}
