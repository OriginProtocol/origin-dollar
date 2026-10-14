// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";

contract Unit_Concrete_UniswapV4RebalanceModule_Views_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    uint256 internal constant Q96 = 2 ** 96;

    //////////////////////////////////////////////////////
    /// --- sqrtPriceX96
    //////////////////////////////////////////////////////

    function test_sqrtPriceX96_readsPoolSlot0() public {
        _setPrice(_priceInRange());
        assertEq(module.sqrtPriceX96(TOKEN_ID), _priceInRange());
    }

    function test_sqrtPriceX96_RevertWhen_notConfigured() public {
        vm.expectRevert("Position not configured");
        module.sqrtPriceX96(TOKEN_ID + 1);
    }

    //////////////////////////////////////////////////////
    /// --- pendingToken1
    //////////////////////////////////////////////////////

    function test_pendingToken1_zeroAtRangeBottom() public view {
        assertEq(module.pendingToken1(TOKEN_ID), 0);
    }

    function test_pendingToken1_zeroWithoutLiquidity() public {
        _setPrice(_priceInRange());
        positionManager.setLiquidity(TOKEN_ID, 0);
        assertEq(module.pendingToken1(TOKEN_ID), 0);
    }

    function test_pendingToken1_inRange() public {
        uint160 price = _priceInRange();
        _setPrice(price);
        assertEq(module.pendingToken1(TOKEN_ID), (uint256(TARGET_LIQUIDITY) * (price - SQRT_PRICE_TICK_0)) / Q96);
    }

    /// @dev ~20k USDe once the whole range is crossed, for the live position's liquidity.
    function test_pendingToken1_clampedAtRangeTop() public {
        _setPrice(SQRT_PRICE_TICK_5 * 2);
        uint256 full = (uint256(TARGET_LIQUIDITY) * (SQRT_PRICE_TICK_5 - SQRT_PRICE_TICK_0)) / Q96;
        assertEq(module.pendingToken1(TOKEN_ID), full);
        assertApproxEqRel(full, 20_000e18, 1e16);
    }

    //////////////////////////////////////////////////////
    /// --- rebalanceStatus
    //////////////////////////////////////////////////////

    function test_rebalanceStatus_notConfigured() public view {
        _assertStatus(TOKEN_ID + 1, false, IUniswapV4RebalanceModule.Reason.NotConfigured);
    }

    function test_rebalanceStatus_balanced() public view {
        _assertStatus(TOKEN_ID, false, IUniswapV4RebalanceModule.Reason.Balanced);
    }

    function test_rebalanceStatus_pullNeeded_evenWhenPaused() public {
        _setPrice(_priceInRange());
        vm.prank(operator);
        module.pause();
        _assertStatus(TOKEN_ID, true, IUniswapV4RebalanceModule.Reason.PullNeeded);
    }

    function test_rebalanceStatus_paused() public {
        positionManager.setLiquidity(TOKEN_ID, 0);
        vm.prank(operator);
        module.pause();
        _assertStatus(TOKEN_ID, false, IUniswapV4RebalanceModule.Reason.Paused);
    }

    function test_rebalanceStatus_reAddNeeded() public {
        positionManager.setLiquidity(TOKEN_ID, 0);
        _assertStatus(TOKEN_ID, true, IUniswapV4RebalanceModule.Reason.ReAddNeeded);
    }

    function test_rebalanceStatus_priceInRange_whenResetDisabled() public {
        vm.prank(address(mockSafe));
        module.configurePosition(TOKEN_ID, _limits(TARGET_LIQUIDITY, MAX_AMOUNT0, 0, MAX_TOKEN1_IN_SAFE));
        positionManager.setLiquidity(TOKEN_ID, 0);
        _setPrice(_priceInRange());
        _assertStatus(TOKEN_ID, false, IUniswapV4RebalanceModule.Reason.PriceInRange);
    }

    function test_rebalanceStatus_exposureCap() public {
        positionManager.setLiquidity(TOKEN_ID, 0);
        token1.mint(address(mockSafe), MAX_TOKEN1_IN_SAFE);
        _assertStatus(TOKEN_ID, false, IUniswapV4RebalanceModule.Reason.ExposureCap);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _assertStatus(uint256 tokenId, bool expectedNeeded, IUniswapV4RebalanceModule.Reason expectedReason)
        internal
        view
    {
        (bool needed, IUniswapV4RebalanceModule.Reason reason) = module.rebalanceStatus(tokenId);
        assertEq(needed, expectedNeeded);
        assertEq(uint8(reason), uint8(expectedReason));
    }
}
