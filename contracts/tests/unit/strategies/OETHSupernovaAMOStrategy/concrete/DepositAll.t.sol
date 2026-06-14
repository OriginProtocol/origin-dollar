// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_DepositAll_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    function test_depositAll_depositsAll() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(mockWeth), address(oethSupernovaAMOStrategy), amount);

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.depositAll();

        // All WETH should be deposited
        assertEq(IERC20(address(mockWeth)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
        // LP tokens should be in gauge
        assertGt(mockSwapXGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_depositAll_noOpOnZero() public {
        // No WETH in strategy - should not revert
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.depositAll();

        assertEq(mockSwapXGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_depositAll_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        oethSupernovaAMOStrategy.depositAll();
    }
}
