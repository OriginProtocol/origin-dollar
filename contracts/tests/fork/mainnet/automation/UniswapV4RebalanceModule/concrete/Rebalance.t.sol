// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_Mainnet_UniswapV4RebalanceModule_Shared_Test
} from "tests/fork/mainnet/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";
import {Vm} from "forge-std/Vm.sol";

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
        uint256 pending = module.pendingToken1(tokenId);
        assertGt(pending, 4_900e18);

        (bool needed, IUniswapV4RebalanceModule.Reason reason) = module.rebalanceStatus(tokenId);
        assertTrue(needed);
        assertEq(uint8(reason), uint8(IUniswapV4RebalanceModule.Reason.PullNeeded));

        assertTrue(_rebalance());

        // Principal plus the 1-pip fee the seller paid.
        assertApproxEqRel(usde.balanceOf(safe) - usdeBefore, pending, 1e13);
        assertEq(_liquidity(), TARGET_LIQUIDITY);
        assertLe(module.sqrtPriceX96(tokenId), _sqrtLower());
        assertEq(module.pendingToken1(tokenId), 0);

        (needed, reason) = module.rebalanceStatus(tokenId);
        assertFalse(needed);
        assertEq(uint8(reason), uint8(IUniswapV4RebalanceModule.Reason.Balanced));
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
        assertGt(module.sqrtPriceX96(tokenId), module.getPosition(tokenId).sqrtPriceUpperX96);
        uint256 pending = module.pendingToken1(tokenId);

        assertTrue(_rebalance());

        assertApproxEqRel(usde.balanceOf(safe) - usdeBefore, pending, 1e13);
        assertEq(_liquidity(), TARGET_LIQUIDITY);
        assertLe(module.sqrtPriceX96(tokenId), _sqrtLower());
    }

    /// @dev The reset swap trades against the other LP, but never below the range bottom.
    function test_rebalance_otherLpInRange_resetBuysTheirUsdeAtOrAbovePar() public {
        otherLp.modifyLiquidity(key, TICK_LOWER, TICK_UPPER, int256(uint256(TARGET_LIQUIDITY)));
        _sellUsde(1_000e18);

        vm.recordLogs();
        assertTrue(_rebalance());
        (uint256 amount0In, uint256 amount1Out) = _priceResetAmounts();

        assertGt(amount0In, 0);
        assertLe(amount0In, MAX_RESET_AMOUNT0);
        // At or above 1 USDe per OUSD, less the 1-pip fee.
        assertGe(amount1Out, (amount0In * (1e6 - 1)) / 1e6);
        assertEq(_liquidity(), TARGET_LIQUIDITY);
        assertLe(module.sqrtPriceX96(tokenId), _sqrtLower());
    }

    function test_rebalance_resetCapReached_skipsThenTopsUp() public {
        otherLp.modifyLiquidity(key, TICK_LOWER, TICK_UPPER, int256(uint256(TARGET_LIQUIDITY)));
        _sellUsde(10_000e18);

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.ReAddSkipped(tokenId, IUniswapV4RebalanceModule.Reason.PriceInRange);
        assertFalse(_rebalance());
        assertEq(_liquidity(), 0);

        // The market takes the other LP's USDe and the price falls back below the range.
        _buyUsde(10_000e18);
        assertLe(module.sqrtPriceX96(tokenId), _sqrtLower());

        (bool needed, IUniswapV4RebalanceModule.Reason reason) = module.rebalanceStatus(tokenId);
        assertTrue(needed);
        assertEq(uint8(reason), uint8(IUniswapV4RebalanceModule.Reason.ReAddNeeded));
        assertTrue(_rebalance());
        assertEq(_liquidity(), TARGET_LIQUIDITY);
    }

    function test_rebalance_exposureCap_skipsUntilUsdeLeavesTheSafe() public {
        deal(address(usde), safe, MAX_TOKEN1_IN_SAFE);
        _sellUsde(1_000e18);

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.ReAddSkipped(tokenId, IUniswapV4RebalanceModule.Reason.ExposureCap);
        assertFalse(_rebalance());
        assertEq(_liquidity(), 0);

        (bool needed, IUniswapV4RebalanceModule.Reason reason) = module.rebalanceStatus(tokenId);
        assertFalse(needed);
        assertEq(uint8(reason), uint8(IUniswapV4RebalanceModule.Reason.ExposureCap));

        // USDe redeemed at Ethena.
        vm.startPrank(safe);
        usde.transfer(makeAddr("Redemption"), usde.balanceOf(safe));
        vm.stopPrank();

        assertTrue(_rebalance());
        assertEq(_liquidity(), TARGET_LIQUIDITY);
    }

    /// @dev Live setup today: the Safe holds almost no OUSD outside the position. The OUSD the pull
    ///      returns plus a stock as large as the USDe bought is enough to restore the position.
    function test_rebalance_stockCoveringTheFillIsEnough() public {
        vm.startPrank(safe);
        ousd.transfer(makeAddr("Elsewhere"), ousd.balanceOf(safe) - 1_000e18);
        vm.stopPrank();
        _sellUsde(900e18);

        assertTrue(_rebalance());
        assertEq(_liquidity(), TARGET_LIQUIDITY);
    }

    function test_rebalance_safeShortOfOusd_keepsThePull() public {
        vm.startPrank(safe);
        ousd.transfer(makeAddr("Elsewhere"), ousd.balanceOf(safe));
        vm.stopPrank();
        _sellUsde(1_000e18);
        uint256 pending = module.pendingToken1(tokenId);

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.ReAddSkipped(tokenId, IUniswapV4RebalanceModule.Reason.AddFailed);
        assertFalse(_rebalance());
        assertEq(_liquidity(), 0);
        assertApproxEqRel(usde.balanceOf(safe), pending, 1e13);
    }

    /// @dev Both allowances run down on every add, so each cycle must set its own.
    function test_rebalance_fiveCyclesInARow() public {
        uint256 usdeBefore = usde.balanceOf(safe);
        for (uint256 i = 0; i < 5; i++) {
            _sellUsde(2_000e18);
            assertTrue(_rebalance());
            assertEq(_liquidity(), TARGET_LIQUIDITY);
        }
        assertApproxEqRel(usde.balanceOf(safe) - usdeBefore, 10_000e18, 1e15);
    }

    function test_rebalance_paused_pullsButDoesNotAdd() public {
        vm.prank(operator);
        module.pause();
        _sellUsde(1_000e18);

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.ReAddSkipped(tokenId, IUniswapV4RebalanceModule.Reason.Paused);
        assertFalse(_rebalance());
        assertEq(_liquidity(), 0);

        (bool needed, IUniswapV4RebalanceModule.Reason reason) = module.rebalanceStatus(tokenId);
        assertFalse(needed);
        assertEq(uint8(reason), uint8(IUniswapV4RebalanceModule.Reason.Paused));

        vm.prank(safe);
        module.unpause();
        assertTrue(_rebalance());
        assertEq(_liquidity(), TARGET_LIQUIDITY);
    }

    function test_pull_removesEverythingToTheSafe() public {
        _sellUsde(1_000e18);
        uint256 usdeBefore = usde.balanceOf(safe);
        uint256 ousdBefore = ousd.balanceOf(safe);

        vm.prank(operator);
        module.pull(tokenId);

        assertEq(_liquidity(), 0);
        assertGt(usde.balanceOf(safe), usdeBefore);
        assertGt(ousd.balanceOf(safe), ousdBefore);
    }

    function test_poolManagerHoldsOusdNonRebasing() public view {
        // 1 = StdNonRebasing: the pool's OUSD balance moves only with transfers.
        assertEq(ousd.rebaseState(address(poolManager)), 1);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_RevertWhen_nothingToDo() public {
        vm.expectRevert("Nothing to rebalance");
        _rebalance();
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _priceResetAmounts() internal returns (uint256 amount0In, uint256 amount1Out) {
        bytes32 topic = IUniswapV4RebalanceModule.PriceReset.selector;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(module) && logs[i].topics[0] == topic) {
                (amount0In, amount1Out,) = abi.decode(logs[i].data, (uint256, uint256, uint160));
                return (amount0In, amount1Out);
            }
        }
        revert("PriceReset not emitted");
    }
}
