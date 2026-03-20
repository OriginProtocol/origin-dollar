// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";
import {BaseCurveAMOStrategy} from "contracts/strategies/BaseCurveAMOStrategy.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_SetMaxSlippage_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_setMaxSlippage_updatesSlippage() public {
        vm.prank(governor);
        baseCurveAMOStrategy.setMaxSlippage(2e16);

        assertEq(baseCurveAMOStrategy.maxSlippage(), 2e16);
    }

    function test_setMaxSlippage_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit BaseCurveAMOStrategy.MaxSlippageUpdated(3e16);

        vm.prank(governor);
        baseCurveAMOStrategy.setMaxSlippage(3e16);
    }

    function test_setMaxSlippage_allows5Percent() public {
        vm.prank(governor);
        baseCurveAMOStrategy.setMaxSlippage(5e16);

        assertEq(baseCurveAMOStrategy.maxSlippage(), 5e16);
    }

    function test_setMaxSlippage_RevertWhen_exceeds5Percent() public {
        vm.prank(governor);
        vm.expectRevert("Slippage must be less than 100%");
        baseCurveAMOStrategy.setMaxSlippage(5e16 + 1);
    }

    function test_setMaxSlippage_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        baseCurveAMOStrategy.setMaxSlippage(1e16);
    }
}
