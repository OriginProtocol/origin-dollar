// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";

contract Unit_Concrete_UniswapV4RebalanceModule_Pull_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_pull_removesAllLiquidityToTheSafe() public {
        positionManager.setAmounts(15_000e18, 5_000e18, 0, 0);

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.LiquidityPulled(TOKEN_ID, TARGET_LIQUIDITY, 15_000e18, 5_000e18);
        vm.prank(operator);
        module.pull(TOKEN_ID);

        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), 0);
        assertEq(token0.balanceOf(address(mockSafe)), SAFE_TOKEN0 + 15_000e18);
        assertEq(token1.balanceOf(address(mockSafe)), 5_000e18);
        assertEq(poolManager.swapCount(), 0);
    }

    function test_pull_worksWhilePaused() public {
        vm.prank(operator);
        module.pause();

        vm.prank(operator);
        module.pull(TOKEN_ID);
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), 0);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_pull_RevertWhen_noLiquidity() public {
        positionManager.setLiquidity(TOKEN_ID, 0);
        vm.prank(operator);
        vm.expectRevert("No liquidity");
        module.pull(TOKEN_ID);
    }

    function test_pull_RevertWhen_notConfigured() public {
        vm.prank(operator);
        vm.expectRevert("Position not configured");
        module.pull(TOKEN_ID + 1);
    }

    function test_pull_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        module.pull(TOKEN_ID);
    }

    function test_pull_RevertWhen_safeCallFails() public {
        mockSafe.setShouldFail(true);
        vm.prank(operator);
        vm.expectRevert("Pull failed");
        module.pull(TOKEN_ID);
    }
}
