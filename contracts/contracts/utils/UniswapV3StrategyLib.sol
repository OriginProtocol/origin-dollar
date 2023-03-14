// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "../interfaces/uniswap/v3/INonfungiblePositionManager.sol";
import "../interfaces/uniswap/v3/IUniswapV3Helper.sol";

library UniswapV3StrategyLib {
    // Represents a position minted by UniswapV3Strategy contract
    struct Position {
        bytes32 positionKey; // Required to read collectible fees from the V3 Pool
        uint256 tokenId; // ERC721 token Id of the minted position
        uint128 liquidity; // Amount of liquidity deployed
        int24 lowerTick; // Lower tick index
        int24 upperTick; // Upper tick index
        bool exists; // True, if position is minted
        // The following two fields are redundant but since we use these
        // two quite a lot, think it might be cheaper to store it than
        // compute it every time?
        uint160 sqrtRatioAX96;
        uint160 sqrtRatioBX96;
    }

    event UniswapV3LiquidityAdded(
        uint256 indexed tokenId,
        uint256 amount0Sent,
        uint256 amount1Sent,
        uint128 liquidityMinted
    );
    event UniswapV3LiquidityRemoved(
        uint256 indexed tokenId,
        uint256 amount0Received,
        uint256 amount1Received,
        uint128 liquidityBurned
    );
    event UniswapV3PositionClosed(
        uint256 indexed tokenId,
        uint256 amount0Received,
        uint256 amount1Received
    );
    event UniswapV3FeeCollected(
        uint256 indexed tokenId,
        uint256 amount0,
        uint256 amount1
    );

    /**
     * @notice Increases liquidity of the position in the pool
     * @param positionManager Uniswap V3 Position manager
     * @param p Position object
     * @param desiredAmount0 Desired amount of token0 to provide liquidity
     * @param desiredAmount1 Desired amount of token1 to provide liquidity
     * @param minAmount0 Min amount of token0 to deposit
     * @param minAmount1 Min amount of token1 to deposit
     * @return liquidity Amount of liquidity added to the pool
     * @return amount0 Amount of token0 added to the position
     * @return amount1 Amount of token1 added to the position
     */
    function increaseLiquidityForPosition(
        address positionManager,
        UniswapV3StrategyLib.Position storage p,
        uint256 desiredAmount0,
        uint256 desiredAmount1,
        uint256 minAmount0,
        uint256 minAmount1
    )
        external
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        require(p.exists, "Unknown position");

        INonfungiblePositionManager.IncreaseLiquidityParams
            memory params = INonfungiblePositionManager
                .IncreaseLiquidityParams({
                    tokenId: p.tokenId,
                    amount0Desired: desiredAmount0,
                    amount1Desired: desiredAmount1,
                    amount0Min: minAmount0,
                    amount1Min: minAmount1,
                    deadline: block.timestamp
                });

        (liquidity, amount0, amount1) = INonfungiblePositionManager(
            positionManager
        ).increaseLiquidity(params);

        p.liquidity += liquidity;

        emit UniswapV3LiquidityAdded(p.tokenId, amount0, amount1, liquidity);
    }

    /**
     * @notice Removes liquidity of the position in the pool
     *
     * @param poolAddress Uniswap V3 pool address
     * @param positionManager Uniswap V3 Position manager
     * @param v3Helper Uniswap V3 helper contract
     * @param p Position object reference
     * @param liquidity Amount of liquidity to remove form the position
     * @param minAmount0 Min amount of token0 to withdraw
     * @param minAmount1 Min amount of token1 to withdraw
     *
     * @return amount0 Amount of token0 received after liquidation
     * @return amount1 Amount of token1 received after liquidation
     */
    function decreaseLiquidityForPosition(
        address poolAddress,
        address positionManager,
        address v3Helper,
        Position storage p,
        uint128 liquidity,
        uint256 minAmount0,
        uint256 minAmount1
    ) external returns (uint256 amount0, uint256 amount1) {
        require(p.exists, "Unknown position");

        (uint160 sqrtRatioX96, , , , , , ) = IUniswapV3Pool(poolAddress)
            .slot0();
        (uint256 exactAmount0, uint256 exactAmount1) = IUniswapV3Helper(
            v3Helper
        ).getAmountsForLiquidity(
                sqrtRatioX96,
                p.sqrtRatioAX96,
                p.sqrtRatioBX96,
                liquidity
            );

        INonfungiblePositionManager.DecreaseLiquidityParams
            memory params = INonfungiblePositionManager
                .DecreaseLiquidityParams({
                    tokenId: p.tokenId,
                    liquidity: liquidity,
                    amount0Min: minAmount0,
                    amount1Min: minAmount1,
                    deadline: block.timestamp
                });

        (amount0, amount1) = INonfungiblePositionManager(positionManager)
            .decreaseLiquidity(params);

        p.liquidity -= liquidity;

        emit UniswapV3LiquidityRemoved(p.tokenId, amount0, amount1, liquidity);
    }

    /**
     * @notice Collects the fees generated by the position on V3 pool
     * @param positionManager Uniswap V3 Position manager
     * @param tokenId Token ID of the position to collect fees of.
     * @return amount0 Amount of token0 collected as fee
     * @return amount1 Amount of token1 collected as fee
     */
    function collectFeesForToken(address positionManager, uint256 tokenId)
        external
        returns (uint256 amount0, uint256 amount1)
    {
        INonfungiblePositionManager.CollectParams
            memory params = INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        (amount0, amount1) = INonfungiblePositionManager(positionManager)
            .collect(params);

        emit UniswapV3FeeCollected(tokenId, amount0, amount1);
    }

    /**
     * @notice Calculates the amount liquidity that needs to be removed
     *          to Withdraw specified amount of the given asset.
     *
     * @param poolAddress Uniswap V3 pool address
     * @param v3Helper Uniswap V3 helper contract
     * @param p         Position object
     * @param _asset    Token needed
     * @param amount    Minimum amount to liquidate
     *
     * @return liquidity    Liquidity to burn
     * @return minAmount0   Minimum amount0 to expect
     * @return minAmount1   Minimum amount1 to expect
     */
    function calculateLiquidityToWithdraw(
        address poolAddress,
        address v3Helper,
        UniswapV3StrategyLib.Position memory p,
        address _asset,
        uint256 amount
    )
        external
        view
        returns (
            uint128 liquidity,
            uint256 minAmount0,
            uint256 minAmount1
        )
    {
        IUniswapV3Helper uniswapV3Helper = IUniswapV3Helper(v3Helper);
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();

        // Total amount in Liquidity pools
        (uint256 totalAmount0, uint256 totalAmount1) = uniswapV3Helper
            .getAmountsForLiquidity(
                sqrtRatioX96,
                p.sqrtRatioAX96,
                p.sqrtRatioBX96,
                p.liquidity
            );

        if (_asset == pool.token0()) {
            minAmount0 = amount;
            minAmount1 = totalAmount1 / (totalAmount0 / amount);
            liquidity = uniswapV3Helper.getLiquidityForAmounts(
                sqrtRatioX96,
                p.sqrtRatioAX96,
                p.sqrtRatioBX96,
                amount,
                minAmount1
            );
        } else if (_asset == pool.token1()) {
            minAmount0 = totalAmount0 / (totalAmount1 / amount);
            minAmount1 = amount;
            liquidity = uniswapV3Helper.getLiquidityForAmounts(
                sqrtRatioX96,
                p.sqrtRatioAX96,
                p.sqrtRatioBX96,
                minAmount0,
                amount
            );
        }
    }
}
