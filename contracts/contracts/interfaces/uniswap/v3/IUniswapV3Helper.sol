// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { INonfungiblePositionManager } from "./INonfungiblePositionManager.sol";

interface IUniswapV3Helper {
    function getAmountsForLiquidity(
        uint160 sqrtRatioX96,
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity
    ) external view returns (uint256 amount0, uint256 amount1);

    function getLiquidityForAmounts(
        uint160 sqrtRatioX96,
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint256 amount0,
        uint256 amount1
    ) external view returns (uint128 liquidity);

    function getSqrtRatioAtTick(int24 tick)
        external
        view
        returns (uint160 sqrtPriceX96);

    function positionFees(
        INonfungiblePositionManager positionManager,
        address poolAddress,
        uint256 tokenId
    ) external view returns (uint256 amount0, uint256 amount1);

    function positionTotal(
        INonfungiblePositionManager positionManager,
        address poolAddress,
        uint256 tokenId,
        uint160 sqrtRatioX96
    ) external view returns (uint256 amount0, uint256 amount1);

    function positionPrincipal(
        INonfungiblePositionManager positionManager,
        uint256 tokenId,
        uint160 sqrtRatioX96
    ) external view returns (uint256 amount0, uint256 amount1);
}
