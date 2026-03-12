// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_Configuration_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    // ----------------
    // setRegistrator
    // ----------------

    function test_setRegistrator_governorCanChange() public {
        vm.prank(governor);
        vm.expectEmit(true, false, false, false);
        emit RegistratorChanged(strategist);
        nativeStakingSSVStrategy.setRegistrator(strategist);
    }

    function test_setRegistrator_RevertWhen_nonGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        nativeStakingSSVStrategy.setRegistrator(strategist);
    }

    // ----------------
    // setFuseInterval
    // ----------------

    function test_setFuseInterval_RevertWhen_nonGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        nativeStakingSSVStrategy.setFuseInterval(21.6 ether, 25.6 ether);
    }

    function test_setFuseInterval_RevertWhen_startLargerThanEnd() public {
        vm.prank(governor);
        vm.expectRevert("Incorrect fuse interval");
        nativeStakingSSVStrategy.setFuseInterval(25.6 ether, 21.6 ether);
    }

    function test_setFuseInterval_RevertWhen_gapLessThan4Ether() public {
        vm.prank(governor);
        vm.expectRevert("Incorrect fuse interval");
        nativeStakingSSVStrategy.setFuseInterval(21.6 ether, 25.5 ether);
    }

    function test_setFuseInterval_RevertWhen_largerThan32Ether() public {
        vm.prank(governor);
        vm.expectRevert("Incorrect fuse interval");
        nativeStakingSSVStrategy.setFuseInterval(32.1 ether, 32.1 ether);
    }

    function test_setFuseInterval_governorCanChange() public {
        vm.prank(governor);
        vm.expectEmit(true, true, false, false);
        emit FuseIntervalUpdated(22.6 ether, 26.6 ether);
        nativeStakingSSVStrategy.setFuseInterval(22.6 ether, 26.6 ether);
    }

    // ----------------
    // setStakingMonitor
    // ----------------

    function test_setStakingMonitor_RevertWhen_nonGovernor() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Governor");
        nativeStakingSSVStrategy.setStakingMonitor(josh);
    }

    // ----------------
    // setStakeETHThreshold
    // ----------------

    function test_setStakeETHThreshold_RevertWhen_nonGovernor() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Governor");
        nativeStakingSSVStrategy.setStakeETHThreshold(32 ether);
    }

    // ----------------
    // resetStakeETHTally
    // ----------------

    function test_resetStakeETHTally_RevertWhen_notMonitor() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Monitor");
        nativeStakingSSVStrategy.resetStakeETHTally();
    }

    // ----------------
    // SSV allowance
    // ----------------

    function test_ssvAllowance_isMaxUint() public view {
        uint256 allowance = mockSsv.allowance(address(nativeStakingSSVStrategy), address(mockSsvNetwork));
        assertEq(allowance, type(uint256).max);
    }

    // ----------------
    // pause
    // ----------------

    function test_pause_strategistCanPause() public {
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        assertTrue(nativeStakingSSVStrategy.paused());
    }

    // ----------------
    // Events
    // ----------------

    event RegistratorChanged(address indexed newAddress);
    event FuseIntervalUpdated(uint256 start, uint256 end);
}
