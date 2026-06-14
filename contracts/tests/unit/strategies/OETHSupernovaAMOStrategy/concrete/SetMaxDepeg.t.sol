// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

// --- Project imports
import {IOETHSupernovaAMOStrategy} from "contracts/interfaces/strategies/IOETHSupernovaAMOStrategy.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_SetMaxDepeg_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    function test_setMaxDepeg_updatesValue() public {
        uint256 newMaxDepeg = 0.02e18;

        vm.prank(governor);
        oethSupernovaAMOStrategy.setMaxDepeg(newMaxDepeg);

        assertEq(oethSupernovaAMOStrategy.maxDepeg(), newMaxDepeg);
    }

    function test_setMaxDepeg_emitsEvent() public {
        uint256 newMaxDepeg = 0.03e18;

        vm.expectEmit(true, true, true, true);
        emit IOETHSupernovaAMOStrategy.MaxDepegUpdated(newMaxDepeg);

        vm.prank(governor);
        oethSupernovaAMOStrategy.setMaxDepeg(newMaxDepeg);
    }

    function test_setMaxDepeg_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        oethSupernovaAMOStrategy.setMaxDepeg(0.01e18);
    }
}
