// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Unit_CurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_CurveAMOStrategy_SafeApproveAllTokens_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_safeApproveAllTokens_setsApprovals() public {
        // Reset hardAsset allowance to 0 first (safeApprove requires non-zero→0→non-zero)
        vm.prank(address(curveAMOStrategy));
        weth.approve(address(curvePool), 0);

        vm.prank(governor);
        curveAMOStrategy.safeApproveAllTokens();

        assertEq(IERC20(address(oeth)).allowance(address(curveAMOStrategy), address(curvePool)), type(uint256).max);
        assertEq(weth.allowance(address(curveAMOStrategy), address(curvePool)), type(uint256).max);
        assertEq(IERC20(address(curvePool)).allowance(address(curveAMOStrategy), address(curveGauge)), type(uint256).max);
    }

    function test_safeApproveAllTokens_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        curveAMOStrategy.safeApproveAllTokens();
    }
}
