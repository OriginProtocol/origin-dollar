// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

contract Unit_Concrete_UniswapV4RebalanceModule_ConfigurePosition_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    uint256 internal constant OTHER_TOKEN_ID = 42;

    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_configurePosition_storesPoolAndRangeFromPositionManager() public view {
        IUniswapV4RebalanceModule.PositionConfig memory cfg = module.getPosition(TOKEN_ID);

        assertEq(cfg.key.currency0, address(token0));
        assertEq(cfg.key.currency1, address(token1));
        assertEq(cfg.key.fee, 0);
        assertEq(cfg.key.tickSpacing, 1);
        assertEq(cfg.key.hooks, address(0));
        assertEq(cfg.poolId, poolId);
        assertEq(cfg.tickLower, TICK_LOWER);
        assertEq(cfg.tickUpper, TICK_UPPER);
        assertEq(cfg.sqrtPriceLowerX96, SQRT_PRICE_TICK_0);
        assertEq(cfg.sqrtPriceUpperX96, SQRT_PRICE_TICK_5);
        assertEq(cfg.limits.targetLiquidity, TARGET_LIQUIDITY);
        assertEq(cfg.limits.maxAmount0, MAX_AMOUNT0);
        assertEq(cfg.limits.maxResetAmount0, MAX_RESET_AMOUNT0);
        assertEq(cfg.limits.maxToken1InSafe, MAX_TOKEN1_IN_SAFE);
    }

    function test_configurePosition_listsTokenIdOnce() public {
        _configurePosition();

        uint256[] memory ids = module.configuredTokenIds();
        assertEq(ids.length, 1);
        assertEq(ids[0], TOKEN_ID);
    }

    function test_configurePosition_updatesLimits() public {
        vm.prank(address(mockSafe));
        module.configurePosition(TOKEN_ID, _limits(1, 2, 0, 3));

        IUniswapV4RebalanceModule.PositionConfig memory cfg = module.getPosition(TOKEN_ID);
        assertEq(cfg.limits.targetLiquidity, 1);
        assertEq(cfg.limits.maxAmount0, 2);
        assertEq(cfg.limits.maxResetAmount0, 0);
        assertEq(cfg.limits.maxToken1InSafe, 3);
    }

    function test_configurePosition_emitsEvent() public {
        vm.expectEmit(true, true, false, true, address(module));
        emit IUniswapV4RebalanceModule.PositionConfigured(
            TOKEN_ID,
            poolId,
            TICK_LOWER,
            TICK_UPPER,
            _limits(TARGET_LIQUIDITY, MAX_AMOUNT0, MAX_RESET_AMOUNT0, MAX_TOKEN1_IN_SAFE)
        );
        _configurePosition();
    }

    function test_configurePosition_negativeTicks() public {
        positionManager.setPosition(OTHER_TOKEN_ID, address(mockSafe), key, -2252, -2238, 1);
        vm.prank(address(mockSafe));
        module.configurePosition(OTHER_TOKEN_ID, _limits(1, 1, 0, 1));

        IUniswapV4RebalanceModule.PositionConfig memory cfg = module.getPosition(OTHER_TOKEN_ID);
        assertEq(cfg.tickLower, -2252);
        assertEq(cfg.tickUpper, -2238);
        assertLt(cfg.sqrtPriceLowerX96, cfg.sqrtPriceUpperX96);
        assertLt(cfg.sqrtPriceUpperX96, SQRT_PRICE_TICK_0);
    }

    function test_removePosition_deletesAndUnlists() public {
        positionManager.setPosition(OTHER_TOKEN_ID, address(mockSafe), key, TICK_LOWER, TICK_UPPER, 1);
        vm.startPrank(address(mockSafe));
        module.configurePosition(OTHER_TOKEN_ID, _limits(1, 1, 0, 1));

        vm.expectEmit(true, false, false, false, address(module));
        emit IUniswapV4RebalanceModule.PositionRemoved(TOKEN_ID);
        module.removePosition(TOKEN_ID);
        vm.stopPrank();

        assertEq(module.getPosition(TOKEN_ID).limits.targetLiquidity, 0);
        uint256[] memory ids = module.configuredTokenIds();
        assertEq(ids.length, 1);
        assertEq(ids[0], OTHER_TOKEN_ID);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_configurePosition_RevertWhen_notSafe() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        module.configurePosition(
            TOKEN_ID, _limits(TARGET_LIQUIDITY, MAX_AMOUNT0, MAX_RESET_AMOUNT0, MAX_TOKEN1_IN_SAFE)
        );
    }

    function test_configurePosition_RevertWhen_targetLiquidityIsZero() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Invalid target liquidity");
        module.configurePosition(TOKEN_ID, _limits(0, MAX_AMOUNT0, MAX_RESET_AMOUNT0, MAX_TOKEN1_IN_SAFE));
    }

    function test_configurePosition_RevertWhen_maxAmount0IsZero() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Invalid max amount0");
        module.configurePosition(TOKEN_ID, _limits(TARGET_LIQUIDITY, 0, MAX_RESET_AMOUNT0, MAX_TOKEN1_IN_SAFE));
    }

    function test_configurePosition_RevertWhen_maxToken1IsZero() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Invalid max token1");
        module.configurePosition(TOKEN_ID, _limits(TARGET_LIQUIDITY, MAX_AMOUNT0, MAX_RESET_AMOUNT0, 0));
    }

    function test_configurePosition_RevertWhen_notOwnedBySafe() public {
        positionManager.setPosition(OTHER_TOKEN_ID, makeAddr("Stranger"), key, TICK_LOWER, TICK_UPPER, 1);
        vm.prank(address(mockSafe));
        vm.expectRevert("Position not owned by Safe");
        module.configurePosition(OTHER_TOKEN_ID, _limits(1, 1, 0, 1));
    }

    function test_configurePosition_RevertWhen_hookedPool() public {
        PoolKey memory hooked = key;
        hooked.hooks = makeAddr("Hook");
        positionManager.setPosition(OTHER_TOKEN_ID, address(mockSafe), hooked, TICK_LOWER, TICK_UPPER, 1);
        vm.prank(address(mockSafe));
        vm.expectRevert("Hooked pool");
        module.configurePosition(OTHER_TOKEN_ID, _limits(1, 1, 0, 1));
    }

    function test_configurePosition_RevertWhen_nativeCurrency() public {
        PoolKey memory native = key;
        native.currency0 = address(0);
        positionManager.setPosition(OTHER_TOKEN_ID, address(mockSafe), native, TICK_LOWER, TICK_UPPER, 1);
        vm.prank(address(mockSafe));
        vm.expectRevert("Native currency");
        module.configurePosition(OTHER_TOKEN_ID, _limits(1, 1, 0, 1));
    }

    function test_configurePosition_RevertWhen_rangeTooWide() public {
        positionManager.setPosition(OTHER_TOKEN_ID, address(mockSafe), key, -887272, 887272, 1);
        vm.prank(address(mockSafe));
        vm.expectRevert("Range too wide");
        module.configurePosition(OTHER_TOKEN_ID, _limits(1, 1, 0, 1));
    }

    function test_removePosition_RevertWhen_notSafe() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        module.removePosition(TOKEN_ID);
    }

    function test_removePosition_RevertWhen_notConfigured() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Position not configured");
        module.removePosition(OTHER_TOKEN_ID);
    }
}
