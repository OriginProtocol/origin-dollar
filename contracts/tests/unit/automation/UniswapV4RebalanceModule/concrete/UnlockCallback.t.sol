// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

contract Unit_Concrete_UniswapV4RebalanceModule_UnlockCallback_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_unlockCallback_RevertWhen_callerIsNotPoolManager() public {
        vm.prank(operator);
        vm.expectRevert("Not the pool manager");
        module.unlockCallback(abi.encode(key, RESET_AMOUNT0, SQRT_PRICE_PAR));
    }
}
