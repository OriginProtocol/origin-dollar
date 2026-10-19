/**
 * Position math for one-sided Uniswap v4 positions, in exact BigInt (X96
 * prices), shared by the v4 liquidity actions.
 */

const Q96 = 1n << 96n;

/** token1 a position holds: L * (min(P, Pu) - Pl) / Q96 when P > Pl. */
export function positionToken1(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  sqrtLowerX96: bigint,
  sqrtUpperX96: bigint
): bigint {
  if (sqrtPriceX96 <= sqrtLowerX96) return 0n;
  const top = sqrtPriceX96 < sqrtUpperX96 ? sqrtPriceX96 : sqrtUpperX96;
  return (liquidity * (top - sqrtLowerX96)) / Q96;
}

/** token0 a position holds: L * (Pu - max(P, Pl)) * Q96 / (max(P, Pl) * Pu). */
export function positionToken0(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  sqrtLowerX96: bigint,
  sqrtUpperX96: bigint
): bigint {
  if (sqrtPriceX96 >= sqrtUpperX96) return 0n;
  const bottom = sqrtPriceX96 > sqrtLowerX96 ? sqrtPriceX96 : sqrtLowerX96;
  return (liquidity * (sqrtUpperX96 - bottom) * Q96) / bottom / sqrtUpperX96;
}

/** Liquidity a token0-only position on [Pl, Pu] gets from `amount0`. */
export function liquidityForToken0(
  amount0: bigint,
  sqrtLowerX96: bigint,
  sqrtUpperX96: bigint
): bigint {
  return (
    (((amount0 * sqrtLowerX96) / Q96) * sqrtUpperX96) /
    (sqrtUpperX96 - sqrtLowerX96)
  );
}

/** int24 tickLower and tickUpper packed in PositionInfo (bits 8-31, 32-55). */
export function unpackTicks(info: bigint): [number, number] {
  const tick = (shift: bigint) => {
    const raw = Number((info >> shift) & 0xffffffn);
    return raw >= 0x800000 ? raw - 0x1000000 : raw;
  };
  return [tick(8n), tick(32n)];
}
