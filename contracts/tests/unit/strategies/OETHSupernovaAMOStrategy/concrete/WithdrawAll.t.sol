// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_WithdrawAll_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    function test_withdrawAll_removesAllLP() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        assertGt(mockSwapXGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        assertEq(mockSwapXGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(mockSwapXPair.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(mockWeth)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdrawAll_burnsOETH() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        // Strategy should have no OETH left
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdrawAll_noOpOnZeroLP() public {
        // No deposit - withdrawAll should not revert
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        assertEq(mockSwapXGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdrawAll_emergencyModePath() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Activate emergency mode on gauge
        mockSwapXGauge.activateEmergencyMode();

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        // All LP should be withdrawn even in emergency mode
        assertEq(mockSwapXGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(mockWeth)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdrawAll_RevertWhen_calledByNonVaultOrGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault or Governor");
        oethSupernovaAMOStrategy.withdrawAll();
    }
}
