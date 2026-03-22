// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_OETHSupernovaAMOStrategy_SetMaxDepeg_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    /// @notice Valid values within range [0.001e18, 0.1e18] are accepted
    function testFuzz_setMaxDepeg_validRange(uint256 value) public {
        value = bound(value, 0.001 ether, 0.1 ether);

        vm.prank(governor);
        oethSupernovaAMOStrategy.setMaxDepeg(value);

        assertEq(oethSupernovaAMOStrategy.maxDepeg(), value);
    }

    /// @notice Values below range revert
    function testFuzz_setMaxDepeg_RevertWhen_belowRange(uint256 value) public {
        value = bound(value, 0, 0.001 ether - 1);

        vm.prank(governor);
        vm.expectRevert("Invalid max depeg range");
        oethSupernovaAMOStrategy.setMaxDepeg(value);
    }

    /// @notice Values above range revert
    function testFuzz_setMaxDepeg_RevertWhen_aboveRange(uint256 value) public {
        value = bound(value, 0.1 ether + 1, type(uint256).max);

        vm.prank(governor);
        vm.expectRevert("Invalid max depeg range");
        oethSupernovaAMOStrategy.setMaxDepeg(value);
    }
}
