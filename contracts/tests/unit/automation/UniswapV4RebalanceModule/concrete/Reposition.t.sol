// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";
import {IPositionManager} from "contracts/interfaces/uniswap/v4/IPositionManager.sol";

contract Unit_Concrete_UniswapV4RebalanceModule_Reposition_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    uint160 internal constant SQRT_PRICE_TICK_1 = 79232123823359799118286999568;
    uint160 internal constant SQRT_PRICE_TICK_3 = 79240047035742135098198828268;
    uint160 internal constant SQRT_PRICE_TICK_8 = 79259858533276714757314932306;
    uint256 internal constant BURNED0 = 20_000e18;
    uint256 internal constant MINTED0 = 20_000e18;

    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_reposition_burnsMintsAndRekeys() public {
        positionManager.setAmounts(BURNED0, 0, MINTED0, 0);
        uint256 expectedId = positionManager.nextTokenId();

        vm.expectCall(address(positionManager), _burnCall());
        vm.expectCall(address(positionManager), _mintCall(3, 8));
        vm.expectEmit(true, true, false, true, address(module));
        emit IUniswapV4RebalanceModule.Repositioned(TOKEN_ID, expectedId, 3, 8);

        vm.prank(operator);
        uint256 newId = module.reposition(TOKEN_ID, 3);

        assertEq(newId, expectedId);
        IUniswapV4RebalanceModule.PositionConfig memory cfg = module.getPosition(newId);
        assertEq(cfg.tickLower, 3);
        assertEq(cfg.tickUpper, 8);
        assertEq(cfg.sqrtPriceLowerX96, SQRT_PRICE_TICK_3);
        assertEq(cfg.sqrtPriceUpperX96, SQRT_PRICE_TICK_8);
        assertEq(cfg.poolId, poolId);
        assertEq(cfg.limits.targetLiquidity, TARGET_LIQUIDITY);
        assertEq(module.getPosition(TOKEN_ID).limits.targetLiquidity, 0);

        uint256[] memory ids = module.configuredTokenIds();
        assertEq(ids.length, 1);
        assertEq(ids[0], newId);

        assertEq(positionManager.ownerOf(newId), address(mockSafe));
        assertEq(positionManager.getPositionLiquidity(newId), TARGET_LIQUIDITY);
        assertEq(poolManager.swapCount(), 0);
    }

    function test_reposition_keepsTheOrderOfConfiguredPositions() public {
        uint256 otherId = 42;
        positionManager.setPosition(otherId, address(mockSafe), key, 10, 15, TARGET_LIQUIDITY);
        vm.prank(address(mockSafe));
        module.configurePosition(otherId, _limits(TARGET_LIQUIDITY, MAX_AMOUNT0, MAX_RESET_AMOUNT0, MAX_TOKEN1_IN_SAFE));
        positionManager.setAmounts(BURNED0, 0, MINTED0, 0);

        vm.prank(operator);
        uint256 newId = module.reposition(TOKEN_ID, 2);

        uint256[] memory ids = module.configuredTokenIds();
        assertEq(ids.length, 2);
        assertEq(ids[0], newId);
        assertEq(ids[1], otherId);
    }

    /// @dev Moving the bid closer to par with the price above the new bottom: the reset swap
    ///      brings it down first, price limited to the new bottom.
    function test_reposition_resetsThePriceToTheNewRangeBottom() public {
        _repositionTo(3);
        uint256 currentId = module.configuredTokenIds()[0];
        _setPrice(SQRT_PRICE_TICK_3);
        positionManager.setAmounts(BURNED0, 0, MINTED0, 0);
        poolManager.setSwapResult(0, 0, SQRT_PRICE_TICK_1);

        vm.prank(operator);
        module.reposition(currentId, 1);

        assertEq(poolManager.swapCount(), 1);
        (bool zeroForOne,, uint160 sqrtPriceLimitX96) = poolManager.lastSwapParams();
        assertTrue(zeroForOne);
        assertEq(sqrtPriceLimitX96, SQRT_PRICE_TICK_1);
    }

    /// @dev Burning pulls whatever token1 the position held, like a rebalance.
    function test_reposition_pullsToken1ToTheSafe() public {
        _setPrice(SQRT_PRICE_TICK_1);
        positionManager.setAmounts(10_000e18, 9_000e18, MINTED0, 0);

        vm.prank(operator);
        module.reposition(TOKEN_ID, 3);

        assertEq(token1.balanceOf(address(mockSafe)), 9_000e18);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_reposition_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        module.reposition(TOKEN_ID, 3);
    }

    function test_reposition_RevertWhen_notConfigured() public {
        vm.prank(operator);
        vm.expectRevert("Position not configured");
        module.reposition(TOKEN_ID + 1, 3);
    }

    function test_reposition_RevertWhen_paused() public {
        vm.startPrank(operator);
        module.pause();
        vm.expectRevert("Paused");
        module.reposition(TOKEN_ID, 3);
        vm.stopPrank();
    }

    function test_reposition_RevertWhen_sameRange() public {
        vm.prank(operator);
        vm.expectRevert("Same range");
        module.reposition(TOKEN_ID, TICK_LOWER);
    }

    /// @dev The Safe's floor is what keeps the operator from ever bidding above par.
    function test_reposition_RevertWhen_belowMinTick() public {
        vm.prank(operator);
        vm.expectRevert("Tick out of bounds");
        module.reposition(TOKEN_ID, MIN_TICK_LOWER - 1);
    }

    function test_reposition_RevertWhen_aboveMaxTick() public {
        vm.prank(operator);
        vm.expectRevert("Tick out of bounds");
        module.reposition(TOKEN_ID, MAX_TICK_LOWER + 1);
    }

    function test_reposition_RevertWhen_tickNotAligned() public {
        PoolKey memory spaced = key;
        spaced.tickSpacing = 10;
        uint256 spacedId = 43;
        positionManager.setPosition(spacedId, address(mockSafe), spaced, 0, 10, TARGET_LIQUIDITY);
        vm.prank(address(mockSafe));
        module.configurePosition(
            spacedId, _limits(TARGET_LIQUIDITY, MAX_AMOUNT0, MAX_RESET_AMOUNT0, MAX_TOKEN1_IN_SAFE)
        );

        vm.prank(operator);
        vm.expectRevert("Tick not aligned");
        module.reposition(spacedId, 15);
    }

    function test_reposition_RevertWhen_priceStaysAboveTheNewRange() public {
        _setPrice(SQRT_PRICE_TICK_3);
        positionManager.setAmounts(BURNED0, 0, MINTED0, 0);
        poolManager.setSwapResult(-int128(MAX_RESET_AMOUNT0), int128(MAX_RESET_AMOUNT0), SQRT_PRICE_TICK_3);
        token1.mint(address(poolManager), MAX_RESET_AMOUNT0);

        vm.prank(operator);
        vm.expectRevert("Price above range");
        module.reposition(TOKEN_ID, 1);
    }

    function test_reposition_RevertWhen_resetDisabledAndPriceAbove() public {
        vm.prank(address(mockSafe));
        module.configurePosition(TOKEN_ID, _limits(TARGET_LIQUIDITY, MAX_AMOUNT0, 0, MAX_TOKEN1_IN_SAFE));
        _setPrice(SQRT_PRICE_TICK_3);
        positionManager.setAmounts(BURNED0, 0, MINTED0, 0);

        vm.prank(operator);
        vm.expectRevert("Price above range");
        module.reposition(TOKEN_ID, 1);
    }

    function test_reposition_RevertWhen_atExposureCap() public {
        token1.mint(address(mockSafe), MAX_TOKEN1_IN_SAFE);
        positionManager.setAmounts(BURNED0, 0, MINTED0, 0);

        vm.prank(operator);
        vm.expectRevert("Exposure cap");
        module.reposition(TOKEN_ID, 3);
    }

    function test_reposition_RevertWhen_burnFails() public {
        mockSafe.setShouldFail(true);
        vm.prank(operator);
        vm.expectRevert("Burn failed");
        module.reposition(TOKEN_ID, 3);
    }

    /// @dev The mint can never take token1: amount1Max is 0.
    function test_reposition_RevertWhen_mintNeedsToken1() public {
        positionManager.setAmounts(BURNED0, 0, MINTED0, 1);
        vm.prank(operator);
        vm.expectRevert("Mint failed");
        module.reposition(TOKEN_ID, 3);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _repositionTo(int24 tickLower) internal {
        positionManager.setAmounts(BURNED0, 0, MINTED0, 0);
        vm.prank(operator);
        module.reposition(TOKEN_ID, tickLower);
    }

    function _burnCall() internal view returns (bytes memory) {
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(TOKEN_ID, uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(address(token0));
        params[2] = abi.encode(address(token1));
        return abi.encodeWithSelector(
            IPositionManager.modifyLiquidities.selector,
            abi.encode(abi.encodePacked(uint8(0x03), uint8(0x12), uint8(0x12)), params),
            block.timestamp
        );
    }

    function _mintCall(int24 tickLower, int24 tickUpper) internal view returns (bytes memory) {
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            key, tickLower, tickUpper, uint256(TARGET_LIQUIDITY), MAX_AMOUNT0, uint128(0), address(mockSafe), bytes("")
        );
        params[1] = abi.encode(address(token0));
        params[2] = abi.encode(address(token1));
        return abi.encodeWithSelector(
            IPositionManager.modifyLiquidities.selector,
            abi.encode(abi.encodePacked(uint8(0x02), uint8(0x12), uint8(0x12)), params),
            block.timestamp
        );
    }
}
