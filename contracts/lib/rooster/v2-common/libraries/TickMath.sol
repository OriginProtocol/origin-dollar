// SPDX-License-Identifier: GPL-2.0-or-later
// As the copyright holder of this work, Ubiquity Labs retains
// the right to distribute, use, and modify this code under any license of
// their choosing, in addition to the terms of the GPL-v2 or later.
pragma solidity ^0.8.25;

import {Math as OzMath} from "../../openzeppelin-custom/contracts/utils/math/Math.sol";
import {Math} from "./Math.sol";
import {MAX_TICK, ONE} from "./Constants.sol";

/**
 * @notice Math functions related to tick operations.
 */
library TickMath {
    using Math for uint256;

    error TickMaxExceeded(int256 tick);

    /**
     * @notice Compute the lower and upper sqrtPrice of a tick.
     * @param tickSpacing The tick spacing used for calculations.
     * @param _tick The input tick value.
     */
    function tickSqrtPrices(
        uint256 tickSpacing,
        int32 _tick
    ) internal pure returns (uint256 sqrtLowerPrice, uint256 sqrtUpperPrice) {
        unchecked {
            sqrtLowerPrice = tickSqrtPrice(tickSpacing, _tick);
            sqrtUpperPrice = tickSqrtPrice(tickSpacing, _tick + 1);
        }
    }

    /**
     * @notice Compute the base tick value from the pool tick and the
     * tickSpacing.  Revert if base tick is beyond the max tick boundary.
     * @param tickSpacing The tick spacing used for calculations.
     * @param _tick The input tick value.
     */
    function subTickIndex(uint256 tickSpacing, int32 _tick) internal pure returns (uint32 subTick) {
        subTick = Math.abs32(_tick);
        subTick *= uint32(tickSpacing);
        if (subTick > MAX_TICK) {
            revert TickMaxExceeded(_tick);
        }
    }

    /**
     * @notice Calculate the square root price for a given tick and tick spacing.
     * @param tickSpacing The tick spacing used for calculations.
     * @param _tick The input tick value.
     * @return _result The square root price.
     */
    function tickSqrtPrice(uint256 tickSpacing, int32 _tick) internal pure returns (uint256 _result) {
        unchecked {
            uint256 tick = subTickIndex(tickSpacing, _tick);

            uint256 ratio = tick & 0x1 != 0 ? 0xfffcb933bd6fad9d3af5f0b9f25db4d6 : 0x100000000000000000000000000000000;
            if (tick & 0x2 != 0) ratio = (ratio * 0xfff97272373d41fd789c8cb37ffcaa1c) >> 128;
            if (tick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656ac9229c67059486f389) >> 128;
            if (tick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e81259b3cddc7a064941) >> 128;
            if (tick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f67b19e8887e0bd251eb7) >> 128;
            if (tick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98cd2e57b660be99eb2c4a) >> 128;
            if (tick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c9838804e327cb417cafcb) >> 128;
            if (tick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99d51e2cc356c2f617dbe0) >> 128;
            if (tick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900aecf64236ab31f1f9dcb5) >> 128;
            if (tick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac4d9194200696907cf2e37) >> 128;
            if (tick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b88206f8abe8a3b44dd9be) >> 128;
            if (tick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c578ef4f1d17b2b235d480) >> 128;
            if (tick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd254ee83bdd3f248e7e785e) >> 128;
            if (tick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d8f7dd10e744d913d033333) >> 128;
            if (tick & 0x4000 != 0) ratio = (ratio * 0x70d869a156ddd32a39e257bc3f50aa9b) >> 128;
            if (tick & 0x8000 != 0) ratio = (ratio * 0x31be135f97da6e09a19dc367e3b6da40) >> 128;
            if (tick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7e5a9780b0cc4e25d61a56) >> 128;
            if (tick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedbcb3a6ccb7ce618d14225) >> 128;
            if (tick & 0x40000 != 0) ratio = (ratio * 0x2216e584f630389b2052b8db590e) >> 128;
            if (_tick > 0) ratio = type(uint256).max / ratio;
            _result = (ratio * ONE) >> 128;
        }
    }

    /**
     * @notice Calculate liquidity of a tick.
     * @param reserveA Tick reserve of token A.
     * @param reserveB Tick reserve of token B.
     * @param sqrtLowerTickPrice The square root price of the lower tick edge.
     * @param sqrtUpperTickPrice The square root price of the upper tick edge.
     */
    function getTickL(
        uint256 reserveA,
        uint256 reserveB,
        uint256 sqrtLowerTickPrice,
        uint256 sqrtUpperTickPrice
    ) internal pure returns (uint256 liquidity) {
        // known:
        // - sqrt price values are different
        // - reserveA and reserveB fit in 128 bit
        // - sqrt price is in (1e-7, 1e7)
        // - D18 max for uint256 is 1.15e59
        // - D18 min is 1e-18

        unchecked {
            // diff is in (5e-12, 4e6); max tick spacing is 10_000
            uint256 diff = sqrtUpperTickPrice - sqrtLowerTickPrice;

            // Need to maximize precision by shifting small values A and B up so
            // that they use more of the available bit range. Two constraints to
            // consider: we need A * B * diff / sqrtPrice to be bigger than 1e-18
            // when the bump is not in play.  This constrains the threshold for
            // bumping to be at least 77 bit; ie, either a or b needs 2^77 which
            // means that term A * B * diff / sqrtPrice > 1e-18.
            //
            // At the other end, the second constraint is that b^2 needs to fit in
            // a 256-bit number, so, post bump, the max reserve value needs to be
            // less than 6e22. With a 78-bit threshold and a 57-bit bump, we have A
            // and B are in (1.4e-1, 4.4e22 (2^(78+57))) with bump, and one of A or
            // B is at least 2^78 without the bump, but the other reserve value may
            // be as small as 1 wei.
            uint256 precisionBump = 0;
            if ((reserveA >> 78) == 0 && (reserveB >> 78) == 0) {
                precisionBump = 57;
                reserveA <<= precisionBump;
                reserveB <<= precisionBump;
            }

            if (reserveB == 0) return Math.divDown(reserveA, diff) >> precisionBump;
            if (reserveA == 0)
                return Math.mulDivDown(reserveB.mulDown(sqrtLowerTickPrice), sqrtUpperTickPrice, diff) >> precisionBump;

            // b is in (7.2e-9 (2^57 / 1e7 / 2), 2.8e29  (2^(78+57) * 1e7 / 2)) with bump
            // b is in a subset of the same range without bump
            uint256 b = (reserveA.divDown(sqrtUpperTickPrice) + reserveB.mulDown(sqrtLowerTickPrice)) >> 1;

            // b^2 is in (5.1e-17, 4.8e58); and will not overflow on either end;
            // A*B is in (3e-13 (2^78 / 1e18 * 1e-18), 1.9e45) without bump and is in a subset range with bump
            // A*B*diff/sqrtUpper is in (1.5e-17 (3e-13 * 5e-12 * 1e7), 7.6e58);

            // Since b^2 is at the upper edge of the precision range, we are not
            // able to multiply the argument of the sqrt by 1e18, instead, we move
            // this factor outside of the sqrt. The resulting loss of precision
            // means that this liquidity value is a lower bound on the tick
            // liquidity
            return
                OzMath.mulDiv(
                    b +
                        Math.sqrt(
                            (OzMath.mulDiv(b, b, ONE) +
                                OzMath.mulDiv(reserveB.mulFloor(reserveA), diff, sqrtUpperTickPrice))
                        ) *
                        1e9,
                    sqrtUpperTickPrice,
                    diff
                ) >> precisionBump;
        }
    }

    /**
     * @notice Calculate square root price of a tick. Returns left edge of the
     * tick if the tick has no reserves.
     * @param reserveA Tick reserve of token A.
     * @param reserveB Tick reserve of token B.
     * @param sqrtLowerTickPrice The square root price of the lower tick edge.
     * @param sqrtUpperTickPrice The square root price of the upper tick edge.
     * @return sqrtPrice The calculated square root price.
     */
    function getSqrtPrice(
        uint256 reserveA,
        uint256 reserveB,
        uint256 sqrtLowerTickPrice,
        uint256 sqrtUpperTickPrice,
        uint256 liquidity
    ) internal pure returns (uint256 sqrtPrice) {
        unchecked {
            if (reserveA == 0) {
                return sqrtLowerTickPrice;
            }
            if (reserveB == 0) {
                return sqrtUpperTickPrice;
            }
            sqrtPrice = Math.sqrt(
                ONE *
                    (reserveA + liquidity.mulDown(sqrtLowerTickPrice)).divDown(
                        reserveB + liquidity.divDown(sqrtUpperTickPrice)
                    )
            );
            sqrtPrice = Math.boundValue(sqrtPrice, sqrtLowerTickPrice, sqrtUpperTickPrice);
        }
    }

    /**
     * @notice Calculate square root price of a tick. Returns left edge of the
     * tick if the tick has no reserves.
     * @param reserveA Tick reserve of token A.
     * @param reserveB Tick reserve of token B.
     * @param sqrtLowerTickPrice The square root price of the lower tick edge.
     * @param sqrtUpperTickPrice The square root price of the upper tick edge.
     * @return sqrtPrice The calculated square root price.
     * @return liquidity The calculated liquidity.
     */
    function getTickSqrtPriceAndL(
        uint256 reserveA,
        uint256 reserveB,
        uint256 sqrtLowerTickPrice,
        uint256 sqrtUpperTickPrice
    ) internal pure returns (uint256 sqrtPrice, uint256 liquidity) {
        liquidity = getTickL(reserveA, reserveB, sqrtLowerTickPrice, sqrtUpperTickPrice);
        sqrtPrice = getSqrtPrice(reserveA, reserveB, sqrtLowerTickPrice, sqrtUpperTickPrice, liquidity);
    }
}