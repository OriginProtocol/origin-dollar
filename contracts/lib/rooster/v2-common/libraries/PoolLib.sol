// SPDX-License-Identifier: GPL-2.0-or-later
// As the copyright holder of this work, Ubiquity Labs retains
// the right to distribute, use, and modify this code under any license of
// their choosing, in addition to the terms of the GPL-v2 or later.
pragma solidity ^0.8.25;

import {SafeCast as Cast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IMaverickV2Pool} from "../interfaces/IMaverickV2Pool.sol";
import {TickMath} from "./TickMath.sol";
import {Math} from "./Math.sol";

/**
 * @notice Library of pool functions.
 */
library PoolLib {
    using Cast for uint256;

    struct AddLiquidityInfo {
        uint256 deltaA;
        uint256 deltaB;
        bool tickLtActive;
        uint256 tickSpacing;
        int32 tick;
    }

    /**
     * @notice Check to ensure that the ticks are in ascending order and amount
     * array is same length as tick array.
     * @param ticks An array of int32 values representing ticks to be checked.
     * @param amountsLength Amount array length.
     */
    function uniqueOrderedTicksCheck(int32[] memory ticks, uint256 amountsLength) internal pure {
        unchecked {
            if (ticks.length != amountsLength)
                revert IMaverickV2Pool.PoolTicksAmountsLengthMismatch(ticks.length, amountsLength);
            int32 lastTick = type(int32).min;
            for (uint256 i; i < ticks.length; ) {
                if (ticks[i] <= lastTick) revert IMaverickV2Pool.PoolTicksNotSorted(i, lastTick, ticks[i]);
                lastTick = ticks[i];
                i = i + 1;
            }
        }
    }

    /**
     * @notice Compute bin reserves assuming the bin is not merged; not accurate
     * reflection of reserves for merged bins.
     * @param bin The storage reference to the state for this bin.
     * @param tick The memory reference to the state for this tick.
     * @return reserveA The reserve amount for token A.
     * @return reserveB The reserve amount for token B.
     */
    function binReserves(
        IMaverickV2Pool.BinState storage bin,
        IMaverickV2Pool.TickState memory tick
    ) internal view returns (uint128 reserveA, uint128 reserveB) {
        return binReserves(bin.tickBalance, tick.reserveA, tick.reserveB, tick.totalSupply);
    }

    /**
     * @notice Compute bin reserves assuming the bin is not merged; not accurate
     * reflection of reserves for merged bins.
     * @param tickBalance Bin's balance in the tick.
     * @param tickReserveA Tick's tokenA reserves.
     * @param tickReserveB Tick's tokenB reserves.
     * @param tickTotalSupply Tick total supply of bin balances.
     */
    function binReserves(
        uint128 tickBalance,
        uint128 tickReserveA,
        uint128 tickReserveB,
        uint128 tickTotalSupply
    ) internal pure returns (uint128 reserveA, uint128 reserveB) {
        if (tickTotalSupply != 0) {
            reserveA = reserveValue(tickReserveA, tickBalance, tickTotalSupply);
            reserveB = reserveValue(tickReserveB, tickBalance, tickTotalSupply);
        }
    }

    /**
     * @notice Reserves of a bin in a tick.
     * @param tickReserve Tick reserve amount in a given token.
     * @param tickBalance Bin's balance in the tick.
     * @param tickTotalSupply Tick total supply of bin balances.
     */
    function reserveValue(
        uint128 tickReserve,
        uint128 tickBalance,
        uint128 tickTotalSupply
    ) internal pure returns (uint128 reserve) {
        reserve = Math.mulDivFloor(tickReserve, tickBalance, tickTotalSupply).toUint128();
        reserve = Math.min128(tickReserve, reserve);
    }

    /**
     * @notice Calculate delta A, delta B, and delta Tick Balance based on delta
     * LP balance and the Tick/Bin state.
     */
    function deltaTickBalanceFromDeltaLpBalance(
        uint256 binTickBalance,
        uint256 binTotalSupply,
        IMaverickV2Pool.TickState memory tickState,
        uint128 deltaLpBalance,
        AddLiquidityInfo memory addLiquidityInfo
    ) internal pure returns (uint256 deltaTickBalance) {
        unchecked {
            if (tickState.reserveA != 0 || tickState.reserveB != 0) {
                // if there are already reserves, then we just contribute pro rata
                // deltaLiquidity = deltaBinLP / binTS * binTickBalance / tickTS * tickL
                uint256 numerator = Math.max(1, binTickBalance) * uint256(deltaLpBalance);
                uint256 denominator = Math.max(1, tickState.totalSupply) * Math.max(1, binTotalSupply);
                addLiquidityInfo.deltaA = Math.mulDivCeil(tickState.reserveA, numerator, denominator);
                addLiquidityInfo.deltaB = Math.mulDivCeil(tickState.reserveB, numerator, denominator);
            } else {
                _setRequiredDeltaReservesForEmptyTick(deltaLpBalance, addLiquidityInfo);
            }

            // round down the amount credited to the tick; this could lead to a
            // small add amount getting zero reserves credit.
            deltaTickBalance = tickState.totalSupply == 0
                ? deltaLpBalance
                : Math.mulDivDown(deltaLpBalance, Math.max(1, binTickBalance), binTotalSupply);
        }
    }

    /**
     * @notice Calculates deltaA = liquidity * (sqrt(upper) - sqrt(lower))
     * @notice Calculates deltaB = liquidity / sqrt(lower) - liquidity / sqrt(upper),
     * @notice i.e. liquidity * (sqrt(upper) - sqrt(lower)) / (sqrt(upper) * sqrt(lower))
     * @notice we set liquidity = deltaLpBalance / (1.0001^(tick * tickspacing) - 1)
     * @notice which simplifies the A/B amounts to:
     * @notice deltaA = deltaLpBalance * sqrt(lower)
     * @notice deltaB = deltaLpBalance / sqrt(upper)
     */
    function _setRequiredDeltaReservesForEmptyTick(
        uint128 deltaLpBalance,
        AddLiquidityInfo memory addLiquidityInfo
    ) internal pure {
        // No reserves, so we will use deltaLpBalance as liquidity to be added.
        // In this logic branch, the tick is empty, so we know the tick will be
        // a one-asset add.
        (uint256 sqrtLowerTickPrice, uint256 sqrtUpperTickPrice) = TickMath.tickSqrtPrices(
            addLiquidityInfo.tickSpacing,
            addLiquidityInfo.tick
        );

        addLiquidityInfo.deltaA = addLiquidityInfo.tickLtActive ? Math.mulCeil(deltaLpBalance, sqrtLowerTickPrice) : 0;
        addLiquidityInfo.deltaB = addLiquidityInfo.tickLtActive ? 0 : Math.divCeil(deltaLpBalance, sqrtUpperTickPrice);
    }
}