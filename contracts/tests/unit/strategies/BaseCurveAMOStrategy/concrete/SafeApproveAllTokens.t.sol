// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_SafeApproveAllTokens_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_safeApproveAllTokens_setsApprovals() public {
        // BaseCurveAMOStrategy uses weth.approve() (not safeApprove), so no need to reset first
        vm.prank(governor);
        baseCurveAMOStrategy.safeApproveAllTokens();

        assertEq(IERC20(address(oeth)).allowance(address(baseCurveAMOStrategy), address(curvePool)), type(uint256).max);
        assertEq(weth.allowance(address(baseCurveAMOStrategy), address(curvePool)), type(uint256).max);
        assertEq(
            IERC20(address(curvePool)).allowance(address(baseCurveAMOStrategy), address(curveGauge)), type(uint256).max
        );
    }

    function test_safeApproveAllTokens_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        baseCurveAMOStrategy.safeApproveAllTokens();
    }
}
