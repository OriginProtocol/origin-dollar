// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IAerodromeAMOStrategy} from "contracts/interfaces/strategies/IAerodromeAMOStrategy.sol";

contract Unit_Concrete_AerodromeAMOStrategy_Admin_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- setAllowedPoolWethShareInterval
    //////////////////////////////////////////////////////

    function test_setAllowedPoolWethShareInterval() public {
        vm.prank(governor);
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.1 ether, 0.9 ether);

        assertEq(aerodromeAMOStrategy.allowedWethShareStart(), 0.1 ether);
        assertEq(aerodromeAMOStrategy.allowedWethShareEnd(), 0.9 ether);
    }

    function test_setAllowedPoolWethShareInterval_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IAerodromeAMOStrategy.PoolWethShareIntervalUpdated(0.1 ether, 0.9 ether);

        vm.prank(governor);
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.1 ether, 0.9 ether);
    }

    function test_setAllowedPoolWethShareInterval_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.1 ether, 0.9 ether);
    }

    function test_setAllowedPoolWethShareInterval_RevertWhen_invalidInterval() public {
        // start >= end
        vm.prank(governor);
        vm.expectRevert("Invalid interval");
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.5 ether, 0.5 ether);
    }

    function test_setAllowedPoolWethShareInterval_RevertWhen_invalidIntervalStartTooLow() public {
        // start <= 0.01 ether
        vm.prank(governor);
        vm.expectRevert("Invalid interval start");
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.01 ether, 0.5 ether);
    }

    function test_setAllowedPoolWethShareInterval_RevertWhen_invalidIntervalEndTooHigh() public {
        // end >= 0.95 ether
        vm.prank(governor);
        vm.expectRevert("Invalid interval end");
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.02 ether, 0.95 ether);
    }

    //////////////////////////////////////////////////////
    /// --- safeApproveAllTokens
    //////////////////////////////////////////////////////

    function test_safeApproveAllTokens() public {
        vm.prank(governor);
        aerodromeAMOStrategy.safeApproveAllTokens();

        // OETHb approved to position manager and swap router
        assertEq(
            IERC20(address(oethBase)).allowance(address(aerodromeAMOStrategy), address(mockPositionManager)),
            type(uint256).max
        );
        assertEq(
            IERC20(address(oethBase)).allowance(address(aerodromeAMOStrategy), address(mockSwapRouter)),
            type(uint256).max
        );

        // WETH un-approved (set to 0) for swap router and position manager
        assertEq(IERC20(address(mockWeth)).allowance(address(aerodromeAMOStrategy), address(mockSwapRouter)), 0);
        assertEq(IERC20(address(mockWeth)).allowance(address(aerodromeAMOStrategy), address(mockPositionManager)), 0);
    }

    function test_safeApproveAllTokens_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        aerodromeAMOStrategy.safeApproveAllTokens();
    }

    //////////////////////////////////////////////////////
    /// --- setPTokenAddress / removePToken
    //////////////////////////////////////////////////////

    function test_setPTokenAddress_RevertWhen_called() public {
        vm.expectRevert("Unsupported method");
        aerodromeAMOStrategy.setPTokenAddress(address(0), address(0));
    }

    function test_removePToken_RevertWhen_called() public {
        vm.expectRevert("Unsupported method");
        aerodromeAMOStrategy.removePToken(0);
    }
}
