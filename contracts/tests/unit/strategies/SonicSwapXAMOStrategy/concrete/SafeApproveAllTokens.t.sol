// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_SafeApproveAllTokens_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_safeApproveAllTokens_approvesGauge() public {
        vm.prank(governor);
        sonicSwapXAMOStrategy.safeApproveAllTokens();

        // LP token approved for gauge
        uint256 allowance =
            IERC20(address(mockSwapXPair)).allowance(address(sonicSwapXAMOStrategy), address(mockSwapXGauge));
        assertEq(allowance, type(uint256).max);
    }

    function test_safeApproveAllTokens_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        sonicSwapXAMOStrategy.safeApproveAllTokens();
    }
}
