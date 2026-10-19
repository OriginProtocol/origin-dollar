// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BaseFeeBridgeModule_Shared_Test} from "tests/unit/automation/BaseFeeBridgeModule/shared/Shared.t.sol";

contract Unit_Concrete_BaseFeeBridgeModule_SetMaxSlippageBps_Test is Unit_BaseFeeBridgeModule_Shared_Test {
    event MaxSlippageBpsUpdated(uint256 maxSlippageBps);

    function test_setMaxSlippageBps_updatesValue() public {
        vm.expectEmit(address(module));
        emit MaxSlippageBpsUpdated(20);

        vm.prank(address(mockSafe));
        module.setMaxSlippageBps(20);

        assertEq(module.maxSlippageBps(), 20);
    }

    function test_setMaxSlippageBps_acceptsCap() public {
        uint256 cap = module.MAX_SLIPPAGE_BPS();

        vm.prank(address(mockSafe));
        module.setMaxSlippageBps(cap);

        assertEq(module.maxSlippageBps(), cap);
    }

    function test_setMaxSlippageBps_revertsAboveCap() public {
        uint256 cap = module.MAX_SLIPPAGE_BPS();

        vm.prank(address(mockSafe));
        vm.expectRevert("Slippage too high");
        module.setMaxSlippageBps(cap + 1);
    }

    function test_setMaxSlippageBps_revertsForOperator() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        module.setMaxSlippageBps(20);
    }
}
