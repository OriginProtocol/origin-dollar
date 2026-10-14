// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";
import {IPermit2} from "contracts/interfaces/uniswap/IPermit2.sol";
import {IPositionManager} from "contracts/interfaces/uniswap/v4/IPositionManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_UniswapV4RebalanceModule_Rebalance_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    uint256 internal constant PULLED0 = 9_000e18;
    uint256 internal constant PULLED1 = 11_000e18;
    uint256 internal constant ADDED0 = 20_000e18;

    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_pullsResetsAndAdds() public {
        _setUpFill(PULLED0, PULLED1, ADDED0);

        vm.expectCall(address(positionManager), _decreaseCall(TARGET_LIQUIDITY));
        vm.expectCall(
            address(token0), abi.encodeWithSelector(IERC20.approve.selector, address(permit2), uint256(MAX_AMOUNT0))
        );
        vm.expectCall(
            address(permit2),
            abi.encodeWithSelector(
                IPermit2.approve.selector, address(token0), address(positionManager), uint160(MAX_AMOUNT0), uint48(0)
            )
        );
        vm.expectCall(address(positionManager), _increaseCall(TARGET_LIQUIDITY));

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.LiquidityPulled(TOKEN_ID, TARGET_LIQUIDITY, PULLED0, PULLED1);
        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.PriceReset(TOKEN_ID, 0, 0, SQRT_PRICE_TICK_0);
        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.LiquidityAdded(TOKEN_ID, TARGET_LIQUIDITY, ADDED0);

        assertTrue(_rebalance());

        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), TARGET_LIQUIDITY);
        assertEq(token1.balanceOf(address(mockSafe)), PULLED1);
        assertEq(token0.balanceOf(address(mockSafe)), SAFE_TOKEN0 + PULLED0 - ADDED0);
    }

    function test_rebalance_resetSwapIsPriceLimitedToRangeBottom() public {
        _setUpFill(PULLED0, PULLED1, ADDED0);
        _rebalance();

        (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) = poolManager.lastSwapParams();
        assertTrue(zeroForOne);
        assertEq(amountSpecified, -int256(uint256(MAX_RESET_AMOUNT0)));
        assertEq(sqrtPriceLimitX96, SQRT_PRICE_TICK_0);
    }

    function test_rebalance_resetTrades_safePaysAndReceives() public {
        _setUpFill(PULLED0, PULLED1, ADDED0);
        poolManager.setSwapResult(-500e18, 499e18, SQRT_PRICE_TICK_0);

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.PriceReset(TOKEN_ID, 500e18, 499e18, SQRT_PRICE_TICK_0);
        assertTrue(_rebalance());

        assertEq(token1.balanceOf(address(mockSafe)), PULLED1 + 499e18);
        assertEq(token0.balanceOf(address(mockSafe)), SAFE_TOKEN0 + PULLED0 - 500e18 - ADDED0);
        assertEq(token0.balanceOf(address(module)), 0);
        assertEq(token1.balanceOf(address(module)), 0);
    }

    function test_rebalance_priceAboveRange() public {
        _setUpFill(0, PULLED1, ADDED0);
        _setPrice(SQRT_PRICE_TICK_5 + 1);

        assertTrue(_rebalance());
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), TARGET_LIQUIDITY);
    }

    function test_rebalance_emptyPositionInRange_resetsAndAddsWithoutPull() public {
        _setUpFill(0, 0, ADDED0);
        positionManager.setLiquidity(TOKEN_ID, 0);

        assertTrue(_rebalance());
        assertEq(positionManager.modifyCount(), 1);
        assertEq(poolManager.swapCount(), 1);
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), TARGET_LIQUIDITY);
    }

    function test_rebalance_topUp_addsOnlyTheMissingLiquidity() public {
        uint128 half = TARGET_LIQUIDITY / 2;
        positionManager.setLiquidity(TOKEN_ID, half);
        positionManager.setAmounts(0, 0, ADDED0 / 2, 0);

        vm.expectCall(address(positionManager), _increaseCall(TARGET_LIQUIDITY - half));
        assertTrue(_rebalance());

        assertEq(positionManager.modifyCount(), 1);
        assertEq(poolManager.swapCount(), 0);
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), TARGET_LIQUIDITY);
    }

    function test_rebalance_threeInARow() public {
        for (uint256 i = 0; i < 3; i++) {
            _setUpFill(PULLED0, PULLED1, ADDED0);
            assertTrue(_rebalance());
        }
        assertEq(token1.balanceOf(address(mockSafe)), 3 * PULLED1);
    }

    function test_rebalance_skips_whenPaused() public {
        _setUpFill(PULLED0, PULLED1, ADDED0);
        vm.prank(operator);
        module.pause();

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.ReAddSkipped(TOKEN_ID, IUniswapV4RebalanceModule.Reason.Paused);
        assertFalse(_rebalance());

        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), 0);
        assertEq(poolManager.swapCount(), 0);
        assertEq(token1.balanceOf(address(mockSafe)), PULLED1);
    }

    function test_rebalance_skips_whenResetDisabled() public {
        vm.prank(address(mockSafe));
        module.configurePosition(TOKEN_ID, _limits(TARGET_LIQUIDITY, MAX_AMOUNT0, 0, MAX_TOKEN1_IN_SAFE));
        _setUpFill(PULLED0, PULLED1, ADDED0);

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.ReAddSkipped(TOKEN_ID, IUniswapV4RebalanceModule.Reason.PriceInRange);
        assertFalse(_rebalance());
        assertEq(poolManager.swapCount(), 0);
    }

    function test_rebalance_skips_whenResetDoesNotReachRangeBottom() public {
        _setUpFill(PULLED0, PULLED1, ADDED0);
        poolManager.setSwapResult(-int128(MAX_RESET_AMOUNT0), int128(MAX_RESET_AMOUNT0), _priceInRange());

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.ReAddSkipped(TOKEN_ID, IUniswapV4RebalanceModule.Reason.PriceInRange);
        assertFalse(_rebalance());
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), 0);
    }

    function test_rebalance_skips_atExposureCap() public {
        _setUpFill(PULLED0, PULLED1, ADDED0);
        token1.mint(address(mockSafe), MAX_TOKEN1_IN_SAFE - PULLED1);

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.ReAddSkipped(TOKEN_ID, IUniswapV4RebalanceModule.Reason.ExposureCap);
        assertFalse(_rebalance());
    }

    /// @dev The cap is a ceiling, not a stock requirement: holding just what the add takes is enough.
    function test_rebalance_addsWithLessThanMaxAmount0InSafe() public {
        _setUpFill(0, PULLED1, ADDED0);
        vm.prank(address(mockSafe));
        token0.transfer(josh, SAFE_TOKEN0 - ADDED0);

        assertTrue(_rebalance());
        assertEq(token0.balanceOf(address(mockSafe)), 0);
    }

    /// @dev A failed add keeps the pull: the token1 stays out of the pool.
    function test_rebalance_skips_whenSafeShortOfToken0() public {
        _setUpFill(0, PULLED1, ADDED0);
        vm.prank(address(mockSafe));
        token0.transfer(josh, SAFE_TOKEN0 - ADDED0 + 1);

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.ReAddSkipped(TOKEN_ID, IUniswapV4RebalanceModule.Reason.AddFailed);
        assertFalse(_rebalance());
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), 0);
        assertEq(token1.balanceOf(address(mockSafe)), PULLED1);
    }

    /// @dev The add can never take token1: amount1Max is 0.
    function test_rebalance_skips_whenAddNeedsToken1() public {
        positionManager.setLiquidity(TOKEN_ID, 0);
        positionManager.setAmounts(0, 0, ADDED0, 1);

        vm.expectEmit(true, false, false, true, address(module));
        emit IUniswapV4RebalanceModule.ReAddSkipped(TOKEN_ID, IUniswapV4RebalanceModule.Reason.AddFailed);
        assertFalse(_rebalance());
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), 0);
    }

    function test_rebalance_safeCanCall() public {
        _setUpFill(PULLED0, PULLED1, ADDED0);
        vm.prank(address(mockSafe));
        assertTrue(module.rebalance(TOKEN_ID));
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_RevertWhen_nothingToRebalance() public {
        vm.expectRevert("Nothing to rebalance");
        _rebalance();
    }

    function test_rebalance_RevertWhen_notConfigured() public {
        vm.prank(operator);
        vm.expectRevert("Position not configured");
        module.rebalance(TOKEN_ID + 1);
    }

    function test_rebalance_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        module.rebalance(TOKEN_ID);
    }

    function test_rebalance_RevertWhen_pullFails() public {
        _setUpFill(PULLED0, PULLED1, ADDED0);
        mockSafe.setShouldFail(true);

        vm.expectRevert("Pull failed");
        _rebalance();
    }

    function test_rebalance_RevertWhen_resetPaymentFails() public {
        _setUpFill(PULLED0, PULLED1, ADDED0);
        poolManager.setSwapResult(-500e18, 499e18, SQRT_PRICE_TICK_0);
        vm.mockCallRevert(
            address(token0), abi.encodeWithSelector(IERC20.transfer.selector, address(poolManager), 500e18), ""
        );

        vm.expectRevert("Reset payment failed");
        _rebalance();
    }

    function test_rebalance_RevertWhen_tokenApprovalFails() public {
        positionManager.setLiquidity(TOKEN_ID, 0);
        mockSafe.setShouldFail(true);

        vm.expectRevert("Token approval failed");
        _rebalance();
    }

    function test_rebalance_RevertWhen_permit2ApprovalFails() public {
        positionManager.setLiquidity(TOKEN_ID, 0);
        vm.mockCallRevert(address(permit2), IPermit2.approve.selector, "");

        vm.expectRevert("Permit2 approval failed");
        _rebalance();
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _decreaseCall(uint128 liquidity) internal view returns (bytes memory) {
        return _modifyCall(0x01, abi.encode(TOKEN_ID, uint256(liquidity), uint128(0), uint128(0), bytes("")));
    }

    function _increaseCall(uint128 liquidity) internal view returns (bytes memory) {
        return _modifyCall(0x00, abi.encode(TOKEN_ID, uint256(liquidity), MAX_AMOUNT0, uint128(0), bytes("")));
    }

    /// @dev The liquidity action followed by CLOSE_CURRENCY on both currencies.
    function _modifyCall(uint8 action, bytes memory liquidityParams) internal view returns (bytes memory) {
        bytes[] memory params = new bytes[](3);
        params[0] = liquidityParams;
        params[1] = abi.encode(address(token0));
        params[2] = abi.encode(address(token1));
        return abi.encodeWithSelector(
            IPositionManager.modifyLiquidities.selector,
            abi.encode(abi.encodePacked(action, uint8(0x12), uint8(0x12)), params),
            block.timestamp
        );
    }
}
