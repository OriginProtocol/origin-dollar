// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CurvePoolBoosterBribesModule_Shared_Test
} from "tests/unit/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol";
import {ICurvePoolBoosterBribesModule} from "contracts/interfaces/automation/ICurvePoolBoosterBribesModule.sol";

contract Unit_Concrete_CurvePoolBoosterBribesModule_SetAdditionalGasLimit_Test is
    Unit_CurvePoolBoosterBribesModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- SET ADDITIONAL GAS LIMIT
    //////////////////////////////////////////////////////

    function test_setAdditionalGasLimit_updatesAndEmitsEvent() public {
        uint256 newLimit = 500_000;

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBoosterBribesModule.AdditionalGasLimitUpdated(newLimit);
        curvePoolBoosterBribesModule.setAdditionalGasLimit(newLimit);

        assertEq(curvePoolBoosterBribesModule.additionalGasLimit(), newLimit);
    }

    function test_setAdditionalGasLimit_RevertWhen_tooHigh() public {
        vm.prank(operator);
        vm.expectRevert("Gas limit too high");
        curvePoolBoosterBribesModule.setAdditionalGasLimit(10_000_001);
    }

    function test_setAdditionalGasLimit_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert();
        curvePoolBoosterBribesModule.setAdditionalGasLimit(500_000);
    }
}
