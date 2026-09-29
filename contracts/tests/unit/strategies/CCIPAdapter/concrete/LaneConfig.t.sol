// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CCIPAdapter_Shared_Test} from "tests/unit/strategies/CCIPAdapter/shared/Shared.t.sol";

contract Unit_Concrete_CCIPAdapter_LaneConfig_Test is Unit_CCIPAdapter_Shared_Test {
    function test_authorise_storesLaneConfig() public {
        vm.prank(governor);
        adapter.authorise(sender, _cfg(DEST_GAS_LIMIT));

        (bool paused, uint64 chainSelector, uint32 destGasLimit) = adapter.laneConfig(sender);
        assertTrue(adapter.authorised(sender));
        assertFalse(paused);
        assertEq(chainSelector, CHAIN_SELECTOR);
        assertEq(destGasLimit, DEST_GAS_LIMIT);
    }

    /// @dev CCIP accepts a 0 gas limit at source, so the adapter must reject it up front.
    function test_authorise_RevertWhen_zeroDestGasLimit() public {
        vm.prank(governor);
        vm.expectRevert("Adapter: zero dest gas");
        adapter.authorise(sender, _cfg(0));
    }

    function test_setLaneConfig_updatesLaneConfig() public {
        vm.startPrank(governor);
        adapter.authorise(sender, _cfg(DEST_GAS_LIMIT));
        adapter.setLaneConfig(sender, _cfg(DEST_GAS_LIMIT * 2));
        vm.stopPrank();

        (,, uint32 destGasLimit) = adapter.laneConfig(sender);
        assertEq(destGasLimit, DEST_GAS_LIMIT * 2);
    }

    function test_setLaneConfig_RevertWhen_zeroDestGasLimit() public {
        vm.startPrank(governor);
        adapter.authorise(sender, _cfg(DEST_GAS_LIMIT));

        vm.expectRevert("Adapter: zero dest gas");
        adapter.setLaneConfig(sender, _cfg(0));
        vm.stopPrank();
    }
}
