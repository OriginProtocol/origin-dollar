// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_MerklPoolBoosterBribesModule_Shared_Test
} from "tests/unit/automation/MerklPoolBoosterBribesModule/shared/Shared.t.sol";

contract Unit_Concrete_MerklPoolBoosterBribesModule_BribeAll_Test is Unit_MerklPoolBoosterBribesModule_Shared_Test {
    function test_bribeAll_forwardsEmptyExclusionListThroughSafe() public {
        address[] memory exclusionList = new address[](0);

        vm.prank(operator);
        module.bribeAll(exclusionList);

        assertEq(mockFactory.callCount(), 1);
        assertEq(mockFactory.getLastExclusionList().length, 0);
    }

    function test_bribeAll_forwardsExclusionListThroughSafe() public {
        address[] memory exclusionList = new address[](2);
        exclusionList[0] = makeAddr("PoolBooster1");
        exclusionList[1] = makeAddr("PoolBooster2");

        vm.prank(operator);
        module.bribeAll(exclusionList);

        address[] memory forwardedList = mockFactory.getLastExclusionList();
        assertEq(mockFactory.callCount(), 1);
        assertEq(forwardedList, exclusionList);
    }

    function test_bribeAll_RevertWhen_notOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        module.bribeAll(new address[](0));
    }

    function test_bribeAll_RevertWhen_safeExecutionFails() public {
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        vm.expectRevert("bribeAll failed");
        module.bribeAll(new address[](0));
    }
}
