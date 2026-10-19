// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_Mainnet_UniswapV4LiquidityModule_Shared_Test
} from "tests/fork/mainnet/automation/UniswapV4LiquidityModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4LiquidityModule} from "contracts/interfaces/automation/IUniswapV4LiquidityModule.sol";

contract Fork_Concrete_Mainnet_UniswapV4LiquidityModule_LivePosition_Test is
    Fork_Mainnet_UniswapV4LiquidityModule_Shared_Test
{
    /// @dev Takes over the live [0, 5] position from module 008: burn it to the Safe and mint
    ///      ~20k OUSD on the single tick [4, 5] (par - 4 bp).
    function test_live_takeOverToOneTick() public {
        uint256 usdeBefore = usde.balanceOf(safe);

        uint256 newTokenId = _rebalance(4, ONE_TICK_LIQUIDITY);

        (int24 tickLower, int24 tickUpper) = _range(newTokenId);
        assertEq(tickLower, 4);
        assertEq(tickUpper, 5);
        assertEq(positionManager.ownerOf(newTokenId), safe);
        assertEq(positionManager.getPositionLiquidity(newTokenId), ONE_TICK_LIQUIDITY);
        (, int24 tick) = _slot0();
        assertLe(tick, 4, "the pool sits at or below the range, so the position is OUSD only");
        // Whatever USDe the old position had bought lands in the Safe.
        assertGe(usde.balanceOf(safe), usdeBefore);
        assertEq(ousd.balanceOf(address(module)), 0);
        assertEq(usde.balanceOf(address(module)), 0);
    }

    /// @dev A seller fills the tick at par - 4 bp or better; the next rebalance pulls the USDe to
    ///      the Safe and re-arms the same tick. A small third-party LP sits in the pool between
    ///      ticks 0 and 4 and takes a few USDe of the sale, hence the 1% tolerance.
    function test_live_fillThenPull() public {
        _rebalance(4, ONE_TICK_LIQUIDITY);
        uint256 ousdOut = _sellUsde(5_000e18);
        assertGt(ousdOut, 0);
        assertLe(ousdOut, (5_000e18 * 9996) / 10_000 + 1e18, "bought at par - 4 bp or better");

        uint256 usdeBefore = usde.balanceOf(safe);
        uint256 newTokenId = _rebalance(4, ONE_TICK_LIQUIDITY);

        assertApproxEqRel(usde.balanceOf(safe), usdeBefore + 5_000e18, 0.01e18);
        (int24 tickLower,) = _range(newTokenId);
        assertEq(tickLower, 4);
    }

    /// @dev During a depeg Talos moves the tick down the market: [30, 31] needs no reset, the
    ///      price is already below it.
    function test_live_followMarketDown() public {
        _rebalance(4, ONE_TICK_LIQUIDITY);
        uint256 newTokenId = _rebalance(30, ONE_TICK_LIQUIDITY);

        (int24 tickLower, int24 tickUpper) = _range(newTokenId);
        assertEq(tickLower, 30);
        assertEq(tickUpper, 31);
    }

    function test_live_RevertWhen_aboveMaxPerDay() public {
        vm.prank(safe);
        module.setMaxPerDay(address(ousd), 1_000e18);

        IUniswapV4LiquidityModule.RebalanceParams memory p;
        p.key = key;
        p.tickLower = 4;
        p.tickUpper = 5;
        p.liquidity = ONE_TICK_LIQUIDITY;
        p.amount0Max = uint128(MAX_PER_CALL);
        vm.prank(operator);
        vm.expectRevert("Above max per day");
        module.rebalance(p);
    }
}
