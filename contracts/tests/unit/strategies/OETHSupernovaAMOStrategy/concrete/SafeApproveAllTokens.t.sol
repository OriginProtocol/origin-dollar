// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_SafeApproveAllTokens_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    function test_safeApproveAllTokens_approvesGauge() public {
        vm.prank(governor);
        oethSupernovaAMOStrategy.safeApproveAllTokens();

        // LP token approved for gauge
        uint256 allowance =
            IERC20(address(mockSwapXPair)).allowance(address(oethSupernovaAMOStrategy), address(mockSwapXGauge));
        assertEq(allowance, type(uint256).max);
    }

    function test_safeApproveAllTokens_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        oethSupernovaAMOStrategy.safeApproveAllTokens();
    }
}
