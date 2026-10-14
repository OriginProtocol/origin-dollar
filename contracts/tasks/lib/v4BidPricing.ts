import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";

/**
 * Bid pricing for the one-sided OUSD Uniswap v4 positions, after the Ethena
 * ARM's setPrices (arm-oeth src/js/tasks/armPrices.js): quote the market at a
 * realistic size and beat it by a small offset, capped so that redeeming what
 * we buy at par still pays.
 *
 * A seller of token1 (USDe) routed through our pool receives OUSD, then sells
 * it for USDC. Per unit of token1 they net `bid * usdcPerOusd`, against
 * `usdcPerToken1` on the best other route. So to win the trade:
 *
 *   bid = usdcPerToken1 * (1 + offset) / usdcPerOusd
 *
 * capped at `1 - redeemCost` (OUSD per token1), the price at which redeeming
 * token1 1:1 for USDC still covers its cost. Prices are plain numbers: the
 * inputs are bps-level quotes, well within double precision.
 */

const BPS = 10_000;
// log(1.0001): one tick is one basis point of price.
const LOG_TICK = Math.log(1.0001);
// A bid within 0.001 bp above the target counts as on it: without this, a cap
// such as 0.9999 (0.00005 ticks past tick 1) would round a whole tick deeper.
const TICK_EPSILON = 1e-3;

export const KYBER_ROUTES_API =
  "https://aggregator-api.kyberswap.com/ethereum/api/v1/routes";

export interface BidPrice {
  /** OUSD paid per token1 at the top of the bid. */
  bid: number;
  /** True when the market is too tight and the bid sits at the redeem cap. */
  capped: boolean;
}

export function targetBidPrice({
  usdcPerToken1,
  usdcPerOusd,
  offsetBps,
  redeemCostBps,
}: {
  usdcPerToken1: number;
  usdcPerOusd: number;
  offsetBps: number;
  redeemCostBps: number;
}): BidPrice {
  if (!(usdcPerToken1 > 0) || !(usdcPerOusd > 0)) {
    throw new Error(
      `Invalid reference rates: ${usdcPerToken1} USDC/token1, ${usdcPerOusd} USDC/OUSD`
    );
  }
  const competitive = (usdcPerToken1 * (1 + offsetBps / BPS)) / usdcPerOusd;
  const cap = 1 - redeemCostBps / BPS;
  return competitive < cap
    ? { bid: competitive, capped: false }
    : { bid: cap, capped: true };
}

/**
 * Lowest lower tick whose top-of-range bid does not exceed `bid`. The position
 * provides currency0 (OUSD) above the price, so at tick t it pays
 * 1.0001^-t OUSD per token1: t = ceil(-ln(bid) / ln(1.0001)), rounded up to
 * the pool's tick spacing.
 */
export function bidToTickLower(bid: number, tickSpacing: number): number {
  if (!(bid > 0)) throw new Error(`Invalid bid ${bid}`);
  const raw = Math.ceil(-Math.log(bid) / LOG_TICK - TICK_EPSILON);
  return Math.ceil(raw / tickSpacing) * tickSpacing;
}

/** Bid at the top of a range starting at `tickLower`, OUSD per token1. */
export function tickLowerToBid(tickLower: number): number {
  return Math.pow(1.0001, -tickLower);
}

export function clampTick(tick: number, min: number, max: number): number {
  return Math.min(Math.max(tick, min), max);
}

/**
 * One quote size per configured position, in `configuredTokenIds()` order. A
 * single value applies to every position.
 */
export function parseQuoteSizes(value: string | number, count: number) {
  const sizes = String(value)
    .split(",")
    .map((s) => Number(s.trim()));
  if (sizes.some((s) => !(s > 0))) {
    throw new Error(
      `Invalid --quote-size "${value}": expected positive numbers`
    );
  }
  if (sizes.length === 1) return Array(count).fill(sizes[0]);
  if (sizes.length !== count) {
    throw new Error(
      `--quote-size has ${sizes.length} values for ${count} configured positions`
    );
  }
  return sizes;
}

/**
 * KyberSwap aggregator rate for selling `amountIn` of tokenIn, in tokenOut per
 * tokenIn. `excludedPools` takes v4 pool ids, so our own pools stay out of the
 * reference we price against.
 */
export async function kyberRate({
  tokenIn,
  tokenOut,
  amountIn,
  decimalsIn,
  decimalsOut,
  excludedPools = [],
  fetchImpl = fetch,
}: {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  decimalsIn: number;
  decimalsOut: number;
  excludedPools?: string[];
  fetchImpl?: typeof fetch;
}): Promise<number> {
  const url = new URL(KYBER_ROUTES_API);
  url.searchParams.set("tokenIn", tokenIn);
  url.searchParams.set("tokenOut", tokenOut);
  url.searchParams.set("amountIn", amountIn.toString());
  if (excludedPools.length > 0) {
    url.searchParams.set("excludedPools", excludedPools.join(","));
  }

  const res = await fetchImpl(url.toString(), {
    headers: { "x-client-id": "origin-talos" },
  });
  if (!res.ok) {
    throw new Error(`Kyber quote failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  const amountOut = body?.data?.routeSummary?.amountOut;
  if (!amountOut) {
    throw new Error(`Kyber quote has no route: ${JSON.stringify(body)}`);
  }
  return (
    Number(formatUnits(amountOut, decimalsOut)) /
    Number(formatUnits(amountIn, decimalsIn))
  );
}
