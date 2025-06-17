// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMaverickV2Factory } from "./IMaverickV2Factory.sol";
import { IMaverickV2Pool } from "./IMaverickV2Pool.sol";

interface IMaverickV2PoolLens {
    error LensTargetPriceOutOfBounds(
        uint256 targetSqrtPrice,
        uint256 sqrtLowerTickPrice,
        uint256 sqrtUpperTickPrice
    );
    error LensTooLittleLiquidity(
        uint256 relativeLiquidityAmount,
        uint256 deltaA,
        uint256 deltaB
    );
    error LensTargetingTokenWithNoDelta(
        bool targetIsA,
        uint256 deltaA,
        uint256 deltaB
    );

    /**
     * @notice Add liquidity slippage parameters for a distribution of liquidity.
     * @param pool Pool where liquidity is being added.
     * @param kind Bin kind; all bins must have the same kind in a given call
     * to addLiquidity.
     * @param ticks Array of tick values to add liquidity to.
     * @param relativeLiquidityAmounts Relative liquidity amounts for the
     * specified ticks.  Liquidity in this case is not bin LP balance, it is
     * the bin liquidity as defined by liquidity = deltaA / (sqrt(upper) -
     * sqrt(lower)) or deltaB = liquidity / sqrt(lower) - liquidity /
     * sqrt(upper).
     * @param addSpec Slippage specification.
     */
    struct AddParamsViewInputs {
        IMaverickV2Pool pool;
        uint8 kind;
        int32[] ticks;
        uint128[] relativeLiquidityAmounts;
        AddParamsSpecification addSpec;
    }

    /**
     * @notice Multi-price add param specification.
     * @param slippageFactorD18 Max slippage allowed as a percent in D18 scale. e.g. 1% slippage is 0.01e18
     * @param numberOfPriceBreaksPerSide Number of price break values on either
     * side of current price.
     * @param targetAmount Target token contribution amount in tokenA if
     * targetIsA is true, otherwise this is the target amount for tokenB.
     * @param targetIsA  Indicates if the target amount is for tokenA or tokenB
     */
    struct AddParamsSpecification {
        uint256 slippageFactorD18;
        uint256 numberOfPriceBreaksPerSide;
        uint256 targetAmount;
        bool targetIsA;
    }

    /**
     * @notice Specification for deriving create pool parameters. Creating a
     * pool in the liquidity manager has several steps:
     *
     * - Deploy pool
     * - Donate a small amount of initial liquidity in the activeTick
     * - Execute a small swap to set the pool price to the desired value
     * - Add liquidity
     *
     * In order to execute these steps, the caller must specify the parameters
     * of each step.  The PoolLens has helper function to derive the values
     * used by the LiquidityManager, but this struct is the input to that
     * helper function and represents the core intent of the pool creator.
     *
     * @param fee Fraction of the pool swap amount that is retained as an LP in
     * D18 scale.
     * @param tickSpacing Tick spacing of pool where 1.0001^tickSpacing is the
     * bin width.
     * @param lookback Pool lookback in seconds.
     * @param tokenA Address of tokenA.
     * @param tokenB Address of tokenB.
     * @param activeTick Tick position that contains the active bins.
     * @param kinds 1-15 number to represent the active kinds
     * 0b0001 = static;
     * 0b0010 = right;
     * 0b0100 = left;
     * 0b1000 = both.
     * e.g. a pool with all 4 modes will have kinds = b1111 = 15
     * @param initialTargetB Amount of B to be donated to the pool after pool
     * create.  This amount needs to be big enough to meet the minimum bin
     * liquidity.
     * @param sqrtPrice Target sqrt price of the pool.
     * @param kind Bin kind; all bins must have the same kind in a given call
     * to addLiquidity.
     * @param ticks Array of tick values to add liquidity to.
     * @param relativeLiquidityAmounts Relative liquidity amounts for the
     * specified ticks.  Liquidity in this case is not bin LP balance, it is
     * the bin liquidity as defined by liquidity = deltaA / (sqrt(upper) -
     * sqrt(lower)) or deltaB = liquidity / sqrt(lower) - liquidity /
     * sqrt(upper).
     * @param targetAmount Target token contribution amount in tokenA if
     * targetIsA is true, otherwise this is the target amount for tokenB.
     * @param targetIsA  Indicates if the target amount is for tokenA or tokenB
     */
    struct CreateAndAddParamsViewInputs {
        uint64 feeAIn;
        uint64 feeBIn;
        uint16 tickSpacing;
        uint32 lookback;
        IERC20 tokenA;
        IERC20 tokenB;
        int32 activeTick;
        uint8 kinds;
        // donate params
        uint256 initialTargetB;
        uint256 sqrtPrice;
        // add target
        uint8 kind;
        int32[] ticks;
        uint128[] relativeLiquidityAmounts;
        uint256 targetAmount;
        bool targetIsA;
    }

    struct Output {
        uint256 deltaAOut;
        uint256 deltaBOut;
        uint256[] deltaAs;
        uint256[] deltaBs;
        uint128[] deltaLpBalances;
    }

    struct Reserves {
        uint256 amountA;
        uint256 amountB;
    }

    struct BinPositionKinds {
        uint128[4] values;
    }

    struct PoolState {
        IMaverickV2Pool.TickState[] tickStateMapping;
        IMaverickV2Pool.BinState[] binStateMapping;
        BinPositionKinds[] binIdByTickKindMapping;
        IMaverickV2Pool.State state;
        Reserves protocolFees;
    }

    struct BoostedPositionSpecification {
        IMaverickV2Pool pool;
        uint32[] binIds;
        uint128[] ratios;
        uint8 kind;
    }

    struct CreateAndAddParamsInputs {
        uint64 feeAIn;
        uint64 feeBIn;
        uint16 tickSpacing;
        uint32 lookback;
        IERC20 tokenA;
        IERC20 tokenB;
        int32 activeTick;
        uint8 kinds;
        // donate params
        IMaverickV2Pool.AddLiquidityParams donateParams;
        // swap params
        uint256 swapAmount;
        // add params
        IMaverickV2Pool.AddLiquidityParams addParams;
        bytes[] packedAddParams;
        uint256 deltaAOut;
        uint256 deltaBOut;
        uint256 preAddReserveA;
        uint256 preAddReserveB;
    }

    struct TickDeltas {
        uint256 deltaAOut;
        uint256 deltaBOut;
        uint256[] deltaAs;
        uint256[] deltaBs;
    }

    /**
     * @notice Converts add parameter slippage specification into add
     * parameters.  The return values are given in both raw format and as packed
     * values that can be used in the LiquidityManager contract.
     */
    function getAddLiquidityParams(AddParamsViewInputs memory params)
        external
        view
        returns (
            bytes memory packedSqrtPriceBreaks,
            bytes[] memory packedArgs,
            uint88[] memory sqrtPriceBreaks,
            IMaverickV2Pool.AddLiquidityParams[] memory addParams,
            IMaverickV2PoolLens.TickDeltas[] memory tickDeltas
        );

    /**
     * @notice Converts add parameter slippage specification and new pool
     * specification into CreateAndAddParamsInputs parameters that can be used in the
     * LiquidityManager contract.
     */
    function getCreatePoolAtPriceAndAddLiquidityParams(
        CreateAndAddParamsViewInputs memory params
    ) external view returns (CreateAndAddParamsInputs memory output);

    /**
     * @notice View function that provides information about pool ticks within
     * a tick radius from the activeTick. Ticks with no reserves are not
     * included in part o f the return array.
     */
    function getTicksAroundActive(IMaverickV2Pool pool, int32 tickRadius)
        external
        view
        returns (
            int32[] memory ticks,
            IMaverickV2Pool.TickState[] memory tickStates
        );

    /**
     * @notice View function that provides information about pool ticks within
     * a range. Ticks with no reserves are not included in part o f the return
     * array.
     */
    function getTicks(
        IMaverickV2Pool pool,
        int32 tickStart,
        int32 tickEnd
    )
        external
        view
        returns (
            int32[] memory ticks,
            IMaverickV2Pool.TickState[] memory tickStates
        );

    /**
     * @notice View function that provides information about pool ticks within
     * a range.  Information returned includes all pool state needed to emulate
     * a swap off chain. Ticks with no reserves are not included in part o f
     * the return array.
     */
    function getTicksAroundActiveWLiquidity(
        IMaverickV2Pool pool,
        int32 tickRadius
    )
        external
        view
        returns (
            int32[] memory ticks,
            IMaverickV2Pool.TickState[] memory tickStates,
            uint256[] memory liquidities,
            uint256[] memory sqrtLowerTickPrices,
            uint256[] memory sqrtUpperTickPrices,
            IMaverickV2Pool.State memory poolState,
            uint256 sqrtPrice,
            uint256 feeAIn,
            uint256 feeBIn
        );

    /**
     * @notice View function that provides pool state information.
     */
    function getFullPoolState(
        IMaverickV2Pool pool,
        uint32 binStart,
        uint32 binEnd
    ) external view returns (PoolState memory poolState);

    /**
     * @notice View function that provides price and liquidity of a given tick.
     */
    function getTickSqrtPriceAndL(IMaverickV2Pool pool, int32 tick)
        external
        view
        returns (uint256 sqrtPrice, uint256 liquidity);

    /**
     * @notice Pool sqrt price.
     */
    function getPoolSqrtPrice(IMaverickV2Pool pool)
        external
        view
        returns (uint256 sqrtPrice);

    /**
     * @notice Pool price.
     */
    function getPoolPrice(IMaverickV2Pool pool)
        external
        view
        returns (uint256 price);

    /**
     * @notice Token scale of two tokens in a pool.
     */
    function tokenScales(IMaverickV2Pool pool)
        external
        view
        returns (uint256 tokenAScale, uint256 tokenBScale);
}
