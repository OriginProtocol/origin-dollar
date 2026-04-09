// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BridgedWOETHStrategy_Shared_Test} from "tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol";

// --- Project imports
import {IBridgedWOETHStrategy} from "contracts/interfaces/strategies/IBridgedWOETHStrategy.sol";

contract Unit_Concrete_BridgedWOETHStrategy_SetMaxPriceDiffBps_Test is Unit_BridgedWOETHStrategy_Shared_Test {
    function test_setMaxPriceDiffBps_updatesValue() public {
        vm.prank(governor);
        bridgedWOETHStrategy.setMaxPriceDiffBps(500);

        assertEq(bridgedWOETHStrategy.maxPriceDiffBps(), 500);
    }

    function test_setMaxPriceDiffBps_emitsMaxPriceDiffBpsUpdated() public {
        vm.expectEmit(true, true, true, true);
        emit IBridgedWOETHStrategy.MaxPriceDiffBpsUpdated(DEFAULT_MAX_PRICE_DIFF_BPS, 500);

        vm.prank(governor);
        bridgedWOETHStrategy.setMaxPriceDiffBps(500);
    }

    function test_setMaxPriceDiffBps_boundary10000() public {
        vm.prank(governor);
        bridgedWOETHStrategy.setMaxPriceDiffBps(10000);

        assertEq(bridgedWOETHStrategy.maxPriceDiffBps(), 10000);
    }

    function test_setMaxPriceDiffBps_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        bridgedWOETHStrategy.setMaxPriceDiffBps(500);
    }

    function test_setMaxPriceDiffBps_RevertWhen_zeroBps() public {
        vm.prank(governor);
        vm.expectRevert("Invalid bps value");
        bridgedWOETHStrategy.setMaxPriceDiffBps(0);
    }

    function test_setMaxPriceDiffBps_RevertWhen_exceeds10000() public {
        vm.prank(governor);
        vm.expectRevert("Invalid bps value");
        bridgedWOETHStrategy.setMaxPriceDiffBps(10001);
    }
}
