// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";

contract Unit_Concrete_UniswapV4RebalanceModule_Pause_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_pause_byOperator() public {
        vm.expectEmit(true, false, false, false, address(module));
        emit IUniswapV4RebalanceModule.Paused(operator);
        vm.prank(operator);
        module.pause();
        assertTrue(module.paused());
    }

    function test_pause_bySafe() public {
        vm.prank(address(mockSafe));
        module.pause();
        assertTrue(module.paused());
    }

    function test_unpause_bySafe() public {
        vm.prank(operator);
        module.pause();

        vm.expectEmit(false, false, false, false, address(module));
        emit IUniswapV4RebalanceModule.Unpaused();
        vm.prank(address(mockSafe));
        module.unpause();
        assertFalse(module.paused());
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_pause_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        module.pause();
    }

    function test_unpause_RevertWhen_operator() public {
        vm.prank(operator);
        module.pause();

        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        module.unpause();
    }
}
