// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Smoke_Base_MerklPoolBoosterBribesModule_Shared_Test
} from "tests/smoke/base/automation/MerklPoolBoosterBribesModule/shared/Shared.t.sol";
import {Base} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_Base_MerklPoolBoosterBribesModule_Test is Smoke_Base_MerklPoolBoosterBribesModule_Shared_Test {
    function test_configuration() public view {
        assertEq(address(module), Base.MerklPoolBoosterBribesModule);
        assertGt(address(module.safeContract()).code.length, 0);
        assertGt(address(factory).code.length, 0);
        assertGt(module.getRoleMemberCount(module.OPERATOR_ROLE()), 0);
    }

    function test_bribeAll() public {
        address liveOperator = module.getRoleMember(module.OPERATOR_ROLE(), 0);
        address[] memory exclusions = _allPoolBoosters();
        vm.prank(liveOperator);
        module.bribeAll(exclusions);
    }
}
