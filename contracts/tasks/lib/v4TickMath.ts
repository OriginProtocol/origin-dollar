/**
 * `TickMath.getSqrtPriceAtTick` from Uniswap v4-core 1.0.2, ported exactly to
 * BigInt. Talos uses it for the reset swap's price limit, which must not land
 * above the range bottom, so it has to match the pool's own rounding.
 */

const MAX_TICK = 887272;
const MAX_UINT256 = (1n << 256n) - 1n;

// 1 / sqrt(1.0001^(2^i)) in Q128.128, for bits 1..19 of |tick|.
const RATIOS = [
  0xfff97272373d413259a46990580e213an,
  0xfff2e50f5f656932ef12357cf3c7fdccn,
  0xffe5caca7e10e4e61c3624eaa0941cd0n,
  0xffcb9843d60f6159c9db58835c926644n,
  0xff973b41fa98c081472e6896dfb254c0n,
  0xff2ea16466c96a3843ec78b326b52861n,
  0xfe5dee046a99a2a811c461f1969c3053n,
  0xfcbe86c7900a88aedcffc83b479aa3a4n,
  0xf987a7253ac413176f2b074cf7815e54n,
  0xf3392b0822b70005940c7a398e4b70f3n,
  0xe7159475a2c29b7443b29c7fa6e889d9n,
  0xd097f3bdfd2022b8845ad8f792aa5825n,
  0xa9f746462d870fdf8a65dc1f90e061e5n,
  0x70d869a156d2a1b890bb3df62baf32f7n,
  0x31be135f97d08fd981231505542fcfa6n,
  0x9aa508b5b7a84e1c677de54f3e99bc9n,
  0x5d6af8dedb81196699c329225ee604n,
  0x2216e584f5fa1ea926041bedfe98n,
  0x48a170391f7dc42444e8fa2n,
];

/** sqrt(1.0001^tick) * 2^96, rounded up like v4-core. */
export function getSqrtPriceAtTick(tick: number): bigint {
  if (!Number.isInteger(tick) || Math.abs(tick) > MAX_TICK) {
    throw new Error(`Invalid tick ${tick}`);
  }
  const absTick = BigInt(Math.abs(tick));
  let price = absTick & 1n ? 0xfffcb933bd6fad37aa2d162d1a594001n : 1n << 128n;
  RATIOS.forEach((ratio, i) => {
    if (absTick & (1n << BigInt(i + 1))) price = (price * ratio) >> 128n;
  });
  if (tick > 0) price = MAX_UINT256 / price;
  return (price + (1n << 32n) - 1n) >> 32n;
}
