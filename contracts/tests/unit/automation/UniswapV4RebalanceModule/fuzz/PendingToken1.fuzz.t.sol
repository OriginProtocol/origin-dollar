// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";

contract Unit_Fuzz_UniswapV4RebalanceModule_PendingToken1_Test is Unit_UniswapV4RebalanceModule_Shared_Test {
    uint256 internal constant Q96 = 2 ** 96;
    uint256 internal constant OTHER_TOKEN_ID = 7;

    /// @dev Matches v4's getAmount1Delta rounded down: L * (min(P, Pu) - Pl) / Q96.
    function testFuzz_pendingToken1_matchesAmount1Delta(uint128 liquidity, uint160 sqrtPrice) public {
        sqrtPrice = uint160(bound(sqrtPrice, SQRT_PRICE_TICK_0 + 1, uint256(SQRT_PRICE_TICK_5) * 4));
        positionManager.setLiquidity(TOKEN_ID, liquidity);
        _setPrice(sqrtPrice);

        uint256 top = sqrtPrice < SQRT_PRICE_TICK_5 ? sqrtPrice : SQRT_PRICE_TICK_5;
        assertEq(module.pendingToken1(TOKEN_ID), (uint256(liquidity) * (top - SQRT_PRICE_TICK_0)) / Q96);
    }

    function testFuzz_pendingToken1_zeroAtOrBelowRange(uint128 liquidity, uint160 sqrtPrice) public {
        sqrtPrice = uint160(bound(sqrtPrice, 4295128739, SQRT_PRICE_TICK_0));
        positionManager.setLiquidity(TOKEN_ID, liquidity);
        _setPrice(sqrtPrice);
        assertEq(module.pendingToken1(TOKEN_ID), 0);
    }

    /// @dev Ticks are unpacked from PositionInfo with their sign, for any narrow range.
    function testFuzz_configurePosition_unpacksTicks(int24 tickLower, uint16 width) public {
        tickLower = int24(bound(tickLower, -800_000, 400_000));
        int24 tickUpper = tickLower + int24(uint24(bound(width, 1, 1000)));
        positionManager.setPosition(OTHER_TOKEN_ID, address(mockSafe), key, tickLower, tickUpper, 1);

        vm.prank(address(mockSafe));
        module.configurePosition(OTHER_TOKEN_ID, _limits(1, 1, 0, 1));

        IUniswapV4RebalanceModule.PositionConfig memory cfg = module.getPosition(OTHER_TOKEN_ID);
        assertEq(cfg.tickLower, tickLower);
        assertEq(cfg.tickUpper, tickUpper);
        assertLt(cfg.sqrtPriceLowerX96, cfg.sqrtPriceUpperX96);
    }
}
