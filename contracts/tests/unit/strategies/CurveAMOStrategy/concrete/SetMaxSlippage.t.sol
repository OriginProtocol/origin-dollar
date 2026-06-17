// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";

// --- Project imports
import {ICurveAMOStrategy} from "contracts/interfaces/strategies/ICurveAMOStrategy.sol";

contract Unit_Concrete_CurveAMOStrategy_SetMaxSlippage_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_setMaxSlippage_updatesSlippage() public {
        vm.prank(governor);
        curveAMOStrategy.setMaxSlippage(2e16);

        assertEq(curveAMOStrategy.maxSlippage(), 2e16);
    }

    function test_setMaxSlippage_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ICurveAMOStrategy.MaxSlippageUpdated(3e16);

        vm.prank(governor);
        curveAMOStrategy.setMaxSlippage(3e16);
    }

    function test_setMaxSlippage_allows5Percent() public {
        vm.prank(governor);
        curveAMOStrategy.setMaxSlippage(5e16);

        assertEq(curveAMOStrategy.maxSlippage(), 5e16);
    }

    function test_setMaxSlippage_RevertWhen_exceeds5Percent() public {
        vm.prank(governor);
        vm.expectRevert("Slippage must be less than 100%");
        curveAMOStrategy.setMaxSlippage(5e16 + 1);
    }

    function test_setMaxSlippage_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        curveAMOStrategy.setMaxSlippage(1e16);
    }
}
