// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_Mainnet_UniswapV4RebalanceModule_Shared_Test
} from "tests/fork/mainnet/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

contract Fork_Concrete_Mainnet_UniswapV4RebalanceModule_Rebalance_Test is
    Fork_Mainnet_UniswapV4RebalanceModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    /// @dev The problem the module solves: without it, the USDe the position bought can be
    ///      bought straight back from the pool.
    function test_withoutRebalance_usdeCanBeBoughtBack() public {
        _sellUsde(5_000e18);
        assertGt(_buyUsde(5_000e18), 4_900e18);
    }

    function test_rebalance_partialFill_pullsUsdeAndRestoresPosition() public {
        uint256 usdeBefore = usde.balanceOf(safe);
        _sellUsde(5_000e18);
        uint256 pending = _pendingUsde();
        assertGt(pending, 4_900e18);

        _rebalance();

        // Principal plus the 1-pip fee the seller paid.
        assertApproxEqRel(usde.balanceOf(safe) - usdeBefore, pending, 1e13);
        assertEq(_liquidity(), TARGET_LIQUIDITY);
        assertLe(_sqrtPrice(), SQRT_PRICE_PAR);
        assertEq(_pendingUsde(), 0);
    }

    function test_rebalance_usdeCannotBeBoughtBackAfterwards() public {
        _sellUsde(5_000e18);
        _rebalance();
        uint256 usdeInSafe = usde.balanceOf(safe);

        assertEq(_buyUsde(5_000e18), 0);
        assertEq(usde.balanceOf(safe), usdeInSafe);
        assertEq(_liquidity(), TARGET_LIQUIDITY);
    }

    function test_rebalance_priceAboveRange() public {
        uint256 usdeBefore = usde.balanceOf(safe);
        _sellUsde(25_000e18);
        assertGt(_sqrtPrice(), SQRT_PRICE_TICK_5);
        uint256 pending = _pendingUsde();

        _rebalance();

        assertApproxEqRel(usde.balanceOf(safe) - usdeBefore, pending, 1e13);
        assertEq(_liquidity(), TARGET_LIQUIDITY);
        assertLe(_sqrtPrice(), SQRT_PRICE_PAR);
    }

    /// @dev The reset swap trades against the other LP, never below the par floor.
    function test_rebalance_otherLpInRange_resetBuysTheirUsde() public {
        otherLp.modifyLiquidity(key, TICK_LOWER, TICK_UPPER, int256(uint256(TARGET_LIQUIDITY)));
        _sellUsde(1_000e18);
        uint256 usdeBefore = usde.balanceOf(safe);
        uint256 pending = _pendingUsde();

        _rebalance();

        // Our own USDe plus what the reset bought from the other LP.
        assertGt(usde.balanceOf(safe) - usdeBefore, pending);
        assertEq(_liquidity(), TARGET_LIQUIDITY);
        assertLe(_sqrtPrice(), SQRT_PRICE_PAR);
    }

    /// @dev When the capped reset cannot bring the price down, the add reverts the whole call;
    ///      Talos then sends a pull only, and re-adds once the market moves the price back.
    function test_rebalance_resetCapReached_pullOnlyThenReAdd() public {
        otherLp.modifyLiquidity(key, TICK_LOWER, TICK_UPPER, int256(uint256(TARGET_LIQUIDITY)));
        _sellUsde(10_000e18);

        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.rebalance(tokenId, TARGET_LIQUIDITY, RESET_AMOUNT0, SQRT_PRICE_PAR);

        _rebalance(0, RESET_AMOUNT0);
        assertEq(_liquidity(), 0);

        // The market takes the other LP's USDe and the price falls back below the range.
        _buyUsde(10_000e18);
        assertLe(_sqrtPrice(), SQRT_PRICE_PAR);
        _rebalance(TARGET_LIQUIDITY, 0);
        assertEq(_liquidity(), TARGET_LIQUIDITY);
    }

    /// @dev Live setup today: the Safe holds almost no OUSD outside the position. The OUSD the pull
    ///      returns plus a stock as large as the USDe bought is enough to restore the position.
    function test_rebalance_stockCoveringTheFillIsEnough() public {
        vm.startPrank(safe);
        ousd.transfer(makeAddr("Elsewhere"), ousd.balanceOf(safe) - 1_000e18);
        vm.stopPrank();
        _sellUsde(900e18);

        _rebalance();
        assertEq(_liquidity(), TARGET_LIQUIDITY);
    }

    function test_rebalance_safeShortOfOusd_pullOnly() public {
        vm.startPrank(safe);
        ousd.transfer(makeAddr("Elsewhere"), ousd.balanceOf(safe));
        vm.stopPrank();
        _sellUsde(1_000e18);
        uint256 pending = _pendingUsde();

        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.rebalance(tokenId, TARGET_LIQUIDITY, RESET_AMOUNT0, SQRT_PRICE_PAR);

        _rebalance(0, 0);
        assertEq(_liquidity(), 0);
        assertApproxEqRel(usde.balanceOf(safe), pending, 1e13);
    }

    /// @dev The Safe's one-time max approvals cover every add.
    function test_rebalance_fiveCyclesInARow() public {
        uint256 usdeBefore = usde.balanceOf(safe);
        for (uint256 i = 0; i < 5; i++) {
            _sellUsde(2_000e18);
            _rebalance();
            assertEq(_liquidity(), TARGET_LIQUIDITY);
        }
        assertApproxEqRel(usde.balanceOf(safe) - usdeBefore, 10_000e18, 1e15);
    }

    function test_poolManagerHoldsOusdNonRebasing() public view {
        // 1 = StdNonRebasing: the pool's OUSD balance moves only with transfers.
        assertEq(ousd.rebaseState(address(poolManager)), 1);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_RevertWhen_priceLimitBelowPar() public {
        _sellUsde(1_000e18);
        vm.prank(operator);
        vm.expectRevert("Price limit below floor");
        module.rebalance(tokenId, 0, RESET_AMOUNT0, SQRT_PRICE_PAR - 1);
    }
}
