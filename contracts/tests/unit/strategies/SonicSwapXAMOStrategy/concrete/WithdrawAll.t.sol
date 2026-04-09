// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_WithdrawAll_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_withdrawAll_removesAllLP() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        assertGt(mockSwapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        assertEq(mockSwapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(mockSwapXPair.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(mockWrappedSonic)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdrawAll_burnsOS() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        // Strategy should have no OS left
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdrawAll_noOpOnZeroLP() public {
        // No deposit - withdrawAll should not revert
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        assertEq(mockSwapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdrawAll_emergencyModePath() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Activate emergency mode on gauge
        mockSwapXGauge.activateEmergencyMode();

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        // All LP should be withdrawn even in emergency mode
        assertEq(mockSwapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(mockWrappedSonic)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdrawAll_RevertWhen_calledByNonVaultOrGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault or Governor");
        sonicSwapXAMOStrategy.withdrawAll();
    }
}
