// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {StableSwapAMMStrategy} from "contracts/strategies/algebra/StableSwapAMMStrategy.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_SetMaxDepeg_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_setMaxDepeg_updatesValue() public {
        uint256 newMaxDepeg = 0.02e18;

        vm.prank(governor);
        sonicSwapXAMOStrategy.setMaxDepeg(newMaxDepeg);

        assertEq(sonicSwapXAMOStrategy.maxDepeg(), newMaxDepeg);
    }

    function test_setMaxDepeg_emitsEvent() public {
        uint256 newMaxDepeg = 0.03e18;

        vm.expectEmit(true, true, true, true);
        emit StableSwapAMMStrategy.MaxDepegUpdated(newMaxDepeg);

        vm.prank(governor);
        sonicSwapXAMOStrategy.setMaxDepeg(newMaxDepeg);
    }

    function test_setMaxDepeg_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        sonicSwapXAMOStrategy.setMaxDepeg(0.01e18);
    }
}
