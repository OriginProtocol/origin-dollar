// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_Base_MerklPoolBoosterBribesModule_Shared_Test
} from "tests/fork/base/automation/MerklPoolBoosterBribesModule/shared/Shared.t.sol";

contract Fork_Concrete_Base_MerklPoolBoosterBribesModule_BribeAll_Test is
    Fork_Base_MerklPoolBoosterBribesModule_Shared_Test
{
    function test_bribeAll_executesThroughRealSafeAndFactory() public {
        assertGt(safe.code.length, 0);
        assertGt(address(factory).code.length, 0);
        address[] memory exclusions = _allPoolBoosters();

        vm.prank(operator);
        module.bribeAll(exclusions);
    }
}
