// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_SonicSwapXAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_SonicSwapXAMOStrategy_CollectRewards_Test is Smoke_SonicSwapXAMOStrategy_Shared_Test {
    function test_collectRewardTokens_doesNotRevert() public {
        address harvester = sonicSwapXAMOStrategy.harvesterAddress();
        vm.prank(harvester);
        sonicSwapXAMOStrategy.collectRewardTokens();
    }
}
