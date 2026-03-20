// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import { INonfungiblePositionManager } from "./INonfungiblePositionManager.sol";

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

    function getLiquidityForAmounts(
        uint256 amount0,
        uint256 amount1,
        uint160 sqrtRatioX96,
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96
    ) external pure returns (uint128 liquidity);

    /// @notice Computes the amount of token0 for a given amount of token1 and price range
    /// @param amount1 Amount of token1 to estimate liquidity
    /// @param pool Address of the pool to be used
    /// @param sqrtRatioX96 A sqrt price representing the current pool prices
    /// @param tickLow Lower tick boundary
    /// @param tickLow Upper tick boundary
    /// @dev   If the given pool address is not the zero address, will fetch `sqrtRatioX96` from pool
    /// @return amount0 Estimated amount of token0
    function estimateAmount0(
        uint256 amount1,
        address pool,
        uint160 sqrtRatioX96,
        int24 tickLow,
        int24 tickHigh
    ) external view returns (uint256 amount0);

    /// @notice Computes the amount of token1 for a given amount of token0 and price range
    /// @param amount0 Amount of token0 to estimate liquidity
    /// @param pool Address of the pool to be used
    /// @param sqrtRatioX96 A sqrt price representing the current pool prices
    /// @param tickLow Lower tick boundary
    /// @param tickLow Upper tick boundary
    /// @dev   If the given pool address is not the zero address, will fetch `sqrtRatioX96` from pool
    /// @return amount1 Estimated amount of token1
    function estimateAmount1(
        uint256 amount0,
        address pool,
        uint160 sqrtRatioX96,
        int24 tickLow,
        int24 tickHigh
    ) external view returns (uint256 amount1);

    ///
    /// Wrappers for PositionValue
    ///

    function principal(
        INonfungiblePositionManager positionManager,
        uint256 tokenId,
        uint160 sqrtRatioX96
    ) external view returns (uint256 amount0, uint256 amount1);

    function fees(INonfungiblePositionManager positionManager, uint256 tokenId)
        external
        view
        returns (uint256 amount0, uint256 amount1);

    ///
    /// Wrappers for TickMath
    ///

    function getSqrtRatioAtTick(int24 tick)
        external
        pure
        returns (uint160 sqrtRatioX96);

    function getTickAtSqrtRatio(uint160 sqrtRatioX96)
        external
        pure
        returns (int24 tick);

    /// @notice Fetches Tick Data for all populated Ticks in given bitmaps
    /// @param pool Address of the pool from which to fetch data
    /// @param startTick Tick from which the first bitmap will be fetched
    /// @dev   The number of bitmaps fetched by this function should always be `MAX_BITMAPS`,
    ///        unless there are less than `MAX_BITMAPS` left to iterate through
    /// @return populatedTicks Array of all Populated Ticks in the provided bitmaps
    function getPopulatedTicks(address pool, int24 startTick)
        external
        view
        returns (PopulatedTick[] memory populatedTicks);
}
