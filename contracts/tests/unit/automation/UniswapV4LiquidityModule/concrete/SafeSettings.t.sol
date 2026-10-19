// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4LiquidityModule_Shared_Test
} from "tests/unit/automation/UniswapV4LiquidityModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4LiquidityModule} from "contracts/interfaces/automation/IUniswapV4LiquidityModule.sol";

contract Unit_Concrete_UniswapV4LiquidityModule_SafeSettings_Test is Unit_UniswapV4LiquidityModule_Shared_Test {
    function test_setMaxPerDay_setsAndEmits() public {
        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4LiquidityModule.MaxPerDaySet(address(token1), 7e18);
        vm.prank(address(mockSafe));
        module.setMaxPerDay(address(token1), 7e18);

        assertEq(module.maxPerDay(address(token1)), 7e18);
    }

    function test_setMaxPerDay_RevertWhen_callerIsNotSafe() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        module.setMaxPerDay(address(token0), 1);
    }
}
