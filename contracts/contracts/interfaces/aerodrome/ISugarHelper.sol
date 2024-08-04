// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import {INonfungiblePositionManager} from "./INonfungiblePositionManager.sol";

interface ISugarHelper {
    struct PopulatedTick {
        int24 tick;
        uint160 sqrtRatioX96;
        int128 liquidityNet;
        uint128 liquidityGross;
    }

    ///
    /// Wrappers for LiquidityAmounts
    ///

    function getAmountsForLiquidity(
        uint160 sqrtRatioX96,
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity
    ) external pure returns (uint256 amount0, uint256 amount1);

    function estimateAmount0(uint256 amount1, address pool, uint160 sqrtRatioX96, int24 tickLow, int24 tickHigh)
        external
        view
        returns (uint256 amount0);

    function estimateAmount1(uint256 amount0, address pool, uint160 sqrtRatioX96, int24 tickLow, int24 tickHigh)
        external
        view
        returns (uint256 amount1);

    ///
    /// Wrappers for PositionValue
    ///

    function principal(INonfungiblePositionManager positionManager, uint256 tokenId, uint160 sqrtRatioX96)
        external
        view
        returns (uint256 amount0, uint256 amount1);

    function fees(INonfungiblePositionManager positionManager, uint256 tokenId)
        external
        view
        returns (uint256 amount0, uint256 amount1);

    ///
    /// Wrappers for TickMath
    ///

    function getSqrtRatioAtTick(int24 tick) external pure returns (uint160 sqrtRatioX96);

    function getTickAtSqrtRatio(uint160 sqrtRatioX96) external pure returns (int24 tick);

    ///
    /// TickLens Helper
    ///

    function getPopulatedTicks(address pool, int24 startTick)
        external
        view
        returns (PopulatedTick[] memory populatedTicks);
}