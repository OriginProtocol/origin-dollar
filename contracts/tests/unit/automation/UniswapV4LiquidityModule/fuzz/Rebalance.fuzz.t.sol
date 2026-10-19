// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4LiquidityModule_Shared_Test
} from "tests/unit/automation/UniswapV4LiquidityModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4LiquidityModule} from "contracts/interfaces/automation/IUniswapV4LiquidityModule.sol";

contract Unit_Fuzz_UniswapV4LiquidityModule_Rebalance_Test is Unit_UniswapV4LiquidityModule_Shared_Test {
    /// @dev Whatever the burn returns, the reset spends and the mint pulls, the call succeeds
    ///      exactly when its net token0 outflow fits today's cap, leaves nothing in the module,
    ///      and records that outflow.
    function testFuzz_rebalance_dailyCapOnNetOutflow(uint256 burned0, uint256 reset0, uint256 minted0) public {
        burned0 = bound(burned0, 0, 100_000e18);
        reset0 = bound(reset0, 0, RESET_AMOUNT);
        minted0 = bound(minted0, 0, AMOUNT0_MAX);
        positionManager.setAmounts(burned0, 0, minted0, 0);
        poolManager.setSwapResult(-int128(int256(reset0)), int128(int256(reset0)), SQRT_PRICE_PAR);

        IUniswapV4LiquidityModule.RebalanceParams memory p = _params(4, 5, LIQUIDITY, AMOUNT0_MAX, RESET_AMOUNT);
        uint256 outflow = reset0 + minted0;
        uint256 expectedSpent = outflow > burned0 ? outflow - burned0 : 0;

        if (expectedSpent > MAX_PER_DAY) {
            vm.expectRevert("Above max per day");
            _rebalance(p);
            return;
        }
        _rebalance(p);
        assertEq(_spentToday(address(token0)), expectedSpent);
        assertEq(token0.balanceOf(address(module)), 0);
        assertEq(token1.balanceOf(address(module)), 0);
        assertEq(token0.balanceOf(address(mockSafe)), SAFE_TOKEN0 + burned0 - outflow);
    }
}
