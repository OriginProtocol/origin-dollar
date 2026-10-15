import { BigNumber, ethers } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { action, types, Logger } from "../lib/action";
import { getOrNull } from "../lib/deployments";
import {
  bidToTickLower,
  curveRate,
  CurvePool,
  kyberRate,
  parseQuoteSizes,
  targetBidPrice,
  tickLowerToBid,
} from "../lib/v4BidPricing";
import { getSqrtPriceAtTick } from "../lib/v4TickMath";
import { logTxDetails } from "../../utils/txLogger";
import addresses from "../../utils/addresses";

// Committed descriptor written by `make deploy-mainnet` for
// scripts/deploy/mainnet/008_UniswapV4RebalanceModule.s.sol.
const MODULE_DEPLOYMENT = "UniswapV4RebalanceModule";

// Narrow inline ABIs: deployment descriptors' ABIs are not a Talos input.
const MODULE_ABI = [
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function safeContract() view returns (address)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function poolManager() view returns (address)",
  "function positionManager() view returns (address)",
  "function poolId() view returns (bytes32)",
  "function minSqrtPriceX96() view returns (uint160)",
  "function maxAmount0() view returns (uint128)",
  "function rebalance(uint256 tokenId, uint128 liquidityToAdd, uint128 resetAmount0, uint160 sqrtPriceLimitX96)",
];
const POSITION_MANAGER_ABI = [
  "function getPoolAndPositionInfo(uint256 tokenId) view returns (tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, uint256 info)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
];
const POOL_MANAGER_ABI = [
  "function extsload(bytes32 slot) view returns (bytes32)",
];
const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address account) view returns (uint256)",
];
// Fallback for the OUSD -> USDC exit leg when KyberSwap fails.
const CURVE_POOL_ABI = [
  "function coins(uint256 i) view returns (address)",
  "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
];

const Q96 = BigNumber.from(2).pow(96);
// Storage slot of `PoolManager._pools`, as used by v4-core `StateLibrary`.
const POOLS_SLOT = 6;
const USDC_DECIMALS = 6;
// A reference outside this band is bad data, not a market to report.
const MIN_SANE_RATE = 0.9;
const MAX_SANE_RATE = 1.1;

export interface RebalancePlan {
  send: boolean;
  why: string;
  liquidityToAdd: BigNumber;
  resetAmount0: BigNumber;
}

/**
 * What to send for one position. The module pulls whatever liquidity the
 * position has, so `liquidityToAdd` is the full target, or 0 to only pull.
 *
 * - Price in or above the range (the position holds token1): pull it once it
 *   is worth the gas, reset the price to the range bottom, re-add the target
 *   unless the Safe already holds `maxToken1InSafe`.
 * - Price at or below the range: top the position up to the target if it is
 *   short, otherwise there is nothing to do.
 */
export function planRebalance({
  priceInRange,
  pendingToken1,
  liquidity,
  targetLiquidity,
  minToken1,
  safeToken1,
  maxToken1InSafe,
  resetAmount0,
}: {
  priceInRange: boolean;
  pendingToken1: BigNumber;
  liquidity: BigNumber;
  targetLiquidity: BigNumber;
  minToken1: BigNumber;
  safeToken1: BigNumber;
  maxToken1InSafe: BigNumber;
  resetAmount0: BigNumber;
}): RebalancePlan {
  const zero = BigNumber.from(0);
  const skip = (why: string) => ({
    send: false,
    why,
    liquidityToAdd: zero,
    resetAmount0: zero,
  });
  const atCap = safeToken1.add(pendingToken1).gte(maxToken1InSafe);
  const add = atCap ? zero : targetLiquidity;

  if (priceInRange) {
    if (liquidity.gt(0) && pendingToken1.lt(minToken1)) return skip("Dust");
    if (liquidity.isZero() && atCap) return skip("ExposureCap");
    return {
      send: true,
      why: liquidity.gt(0)
        ? atCap
          ? "Pull (exposure cap, no re-add)"
          : "Pull and re-add"
        : "Re-add",
      liquidityToAdd: add,
      // The reset only serves the re-add.
      resetAmount0: add.isZero() ? zero : resetAmount0,
    };
  }
  // Within 1% of the target is close enough: topping up the rounding left
  // by the last add would only spend gas.
  if (liquidity.mul(100).gte(targetLiquidity.mul(99))) return skip("Balanced");
  if (atCap) return skip("ExposureCap");
  return {
    send: true,
    why: "Top up",
    liquidityToAdd: add,
    resetAmount0: zero,
  };
}

/** token1 a position holds: L * (min(P, Pu) - Pl) / Q96 when P > Pl. */
export function pendingToken1({
  liquidity,
  sqrtPriceX96,
  sqrtLowerX96,
  sqrtUpperX96,
}: {
  liquidity: BigNumber;
  sqrtPriceX96: BigNumber;
  sqrtLowerX96: BigNumber;
  sqrtUpperX96: BigNumber;
}): BigNumber {
  if (sqrtPriceX96.lte(sqrtLowerX96)) return BigNumber.from(0);
  const top = sqrtPriceX96.lt(sqrtUpperX96) ? sqrtPriceX96 : sqrtUpperX96;
  return liquidity.mul(top.sub(sqrtLowerX96)).div(Q96);
}

/** token0 (OUSD) a position holds: L * (Pu - max(P, Pl)) * Q96 / (max(P, Pl) * Pu). */
export function positionToken0({
  liquidity,
  sqrtPriceX96,
  sqrtLowerX96,
  sqrtUpperX96,
}: {
  liquidity: BigNumber;
  sqrtPriceX96: BigNumber;
  sqrtLowerX96: BigNumber;
  sqrtUpperX96: BigNumber;
}): BigNumber {
  if (sqrtPriceX96.gte(sqrtUpperX96)) return BigNumber.from(0);
  const bottom = sqrtPriceX96.gt(sqrtLowerX96) ? sqrtPriceX96 : sqrtLowerX96;
  return liquidity
    .mul(sqrtUpperX96.sub(bottom))
    .mul(Q96)
    .div(bottom)
    .div(sqrtUpperX96);
}

/** Liquidity an OUSD-only position on [Pl, Pu] gets from `amount0` OUSD. */
export function liquidityForToken0({
  amount0,
  sqrtLowerX96,
  sqrtUpperX96,
}: {
  amount0: BigNumber;
  sqrtLowerX96: BigNumber;
  sqrtUpperX96: BigNumber;
}): BigNumber {
  return amount0
    .mul(sqrtLowerX96)
    .div(Q96)
    .mul(sqrtUpperX96)
    .div(sqrtUpperX96.sub(sqrtLowerX96));
}

// Kept back from the OUSD the Safe can put in, for rounding.
const FUND_MARGIN_BPS = 50;

/**
 * OUSD to keep in a position: `--target-ousd`, capped at what the Safe can
 * fund after the pull (its own OUSD, plus the OUSD the position returns,
 * less what the reset swap may sell), with a 0.5% margin.
 */
export function fundableToken0({
  targetToken0,
  safeToken0,
  positionToken0,
  resetAmount0,
}: {
  targetToken0: BigNumber;
  safeToken0: BigNumber;
  positionToken0: BigNumber;
  resetAmount0: BigNumber;
}): BigNumber {
  const available = safeToken0
    .add(positionToken0)
    .mul(10_000 - FUND_MARGIN_BPS)
    .div(10_000)
    .sub(resetAmount0);
  if (available.lte(0)) return BigNumber.from(0);
  return available.lt(targetToken0) ? available : targetToken0;
}

/** int24 tickLower and tickUpper packed in PositionInfo (bits 8-31, 32-55). */
export function unpackTicks(info: BigNumber): [number, number] {
  const tick = (shift: number) => {
    const raw = info.shr(shift).and(0xffffff).toNumber();
    return raw >= 0x800000 ? raw - 0x1000000 : raw;
  };
  return [tick(8), tick(32)];
}

/**
 * Whether the market-implied lower tick is far enough from a position's range
 * to tell the Safe, which owns the pricing decision.
 */
export function pricingAlert({
  current,
  target,
  alertTickMove,
}: {
  current: number;
  target: number;
  alertTickMove: number;
}): boolean {
  return Math.abs(target - current) >= alertTickMove;
}

/** One value per position, or a single value for all of them. */
function perPosition(value: string | number, count: number, label: string) {
  const values = String(value)
    .split(",")
    .map((v) => v.trim());
  if (values.length === 1) return Array(count).fill(values[0]);
  if (values.length !== count) {
    throw new Error(
      `${label} has ${values.length} values for ${count} positions`
    );
  }
  return values;
}

interface Token {
  address: string;
  decimals: number;
  symbol: string;
}

async function tokenInfo(
  address: string,
  provider: ethers.providers.Provider
): Promise<Token> {
  const token = new ethers.Contract(address, ERC20_ABI, provider);
  const [decimals, symbol] = await Promise.all([
    token.decimals(),
    token.symbol(),
  ]);
  return { address, decimals, symbol };
}

/**
 * Market-implied lower tick from KyberSwap quotes at `quoteSize`: where a
 * range should start to beat the market by the offset without bidding above
 * what redeeming 1:1 returns.
 */
async function marketTickLower({
  tickSpacing,
  token0,
  token1,
  quoteSize,
  offsetBps,
  redeemCostBps,
  excludedPools,
  provider,
  log,
}: {
  tickSpacing: number;
  token0: Token;
  token1: Token;
  quoteSize: number;
  offsetBps: number;
  redeemCostBps: number;
  excludedPools: string[];
  provider: ethers.providers.Provider;
  log: Logger;
}): Promise<number> {
  const amountIn = (token: Token) =>
    parseUnits(String(quoteSize), token.decimals);
  const quote = (token: Token) =>
    kyberRate({
      tokenIn: token.address,
      tokenOut: addresses.mainnet.USDC,
      amountIn: amountIn(token),
      decimalsIn: token.decimals,
      decimalsOut: USDC_DECIMALS,
      excludedPools,
    });
  // The exit leg falls back to the Curve OUSD/USDC pool, which is where
  // KyberSwap routes it today.
  const exitQuote = async () => {
    try {
      return await quote(token0);
    } catch (err) {
      log.warn(
        `KyberSwap ${token0.symbol} -> USDC quote failed (${
          (err as Error).message
        }); using Curve get_dy`
      );
      return curveRate({
        pool: new ethers.Contract(
          addresses.mainnet.curve.OUSD_USDC.pool,
          CURVE_POOL_ABI,
          provider
        ) as unknown as CurvePool,
        tokenIn: token0.address,
        tokenOut: addresses.mainnet.USDC,
        amountIn: amountIn(token0),
        decimalsIn: token0.decimals,
        decimalsOut: USDC_DECIMALS,
      });
    }
  };
  const [usdcPerToken1, usdcPerOusd] = await Promise.all([
    quote(token1),
    exitQuote(),
  ]);
  for (const [label, rate] of [
    [`USDC/${token1.symbol}`, usdcPerToken1],
    [`USDC/${token0.symbol}`, usdcPerOusd],
  ] as const) {
    if (rate < MIN_SANE_RATE || rate > MAX_SANE_RATE) {
      throw new Error(`${label} quote ${rate} is outside the sane band`);
    }
  }

  const { bid, capped } = targetBidPrice({
    usdcPerToken1,
    usdcPerOusd,
    offsetBps,
    redeemCostBps,
  });
  const tick = bidToTickLower(bid, tickSpacing);

  log.info(
    `Quotes for ${quoteSize} ${token1.symbol}: ${usdcPerToken1.toFixed(
      6
    )} USDC/${token1.symbol}, ${usdcPerOusd.toFixed(6)} USDC/${
      token0.symbol
    }; bid ${bid.toFixed(6)} ${token0.symbol}/${token1.symbol}${
      capped ? " (capped at the redeem cost: the market is tighter)" : ""
    } -> lower tick ${tick}, top bid ${tickLowerToBid(tick).toFixed(6)}`
  );
  return tick;
}

action({
  name: "ousdV4Rebalance",
  description:
    "Keep the OUSD Uniswap v4 positions one-sided: pull the token they bought (USDe) to the Safe and put the OUSD back, via UniswapV4RebalanceModule, and report where KyberSwap quotes would put each range",
  chains: [1],
  params: (t) => {
    t.addOptionalParam(
      "tokenIds",
      "Safe positions to manage, comma separated",
      "457273",
      types.string
    );
    t.addOptionalParam(
      "targetOusd",
      "OUSD to keep in each position, in whole units, capped at what the Safe can fund. One value, or one per position",
      "20000",
      types.string
    );
    t.addOptionalParam(
      "resetAmount",
      "Max OUSD the reset swap may sell, in whole units (capped by the module)",
      100,
      types.float
    );
    t.addOptionalParam(
      "maxToken1InSafe",
      "Stop re-adding once the Safe would hold this much of the bought token (whole units)",
      1_000_000,
      types.float
    );
    t.addOptionalParam(
      "minToken1",
      "Smallest amount of the bought token (whole units) worth a pull",
      10,
      types.float
    );
    t.addOptionalParam(
      "quoteSize",
      "Size of the reference quote, in token1 units (USDe). One value, or one per position",
      "100000",
      types.string
    );
    t.addOptionalParam(
      "offsetBps",
      "How much better than the market the reported bid is, in bps",
      0.2,
      types.float
    );
    t.addOptionalParam(
      "redeemCostBps",
      "Cost of redeeming token1 1:1 for USDC, in bps; the reported bid never goes above 1 minus this",
      1,
      types.float
    );
    t.addOptionalParam(
      "alertTickMove",
      "Warn when the market-implied lower tick is at least this far from a range",
      3,
      types.int
    );
    t.addFlag("skipPricing", "Do not fetch quotes, only pull and re-add");
    t.addOptionalParam(
      "maxGas",
      "Skip a rebalance estimated above this gas (a seller pushing the price far above an empty range makes the reset walk thousands of ticks)",
      25_000_000,
      types.int
    );
    t.addFlag("dryrun", "Simulate, but do not send any transaction");
  },
  run: async ({ signer, args, log }) => {
    const dryrun = !!args.dryrun;
    const maxGas = BigNumber.from(args.maxGas);
    const provider = signer.provider!;

    const deployment = getOrNull(MODULE_DEPLOYMENT);
    if (!deployment) {
      throw new Error(
        `${MODULE_DEPLOYMENT} is not deployed: deployments/mainnet/${MODULE_DEPLOYMENT}.json is missing`
      );
    }
    const module = new ethers.Contract(deployment.address, MODULE_ABI, signer);

    const signerAddress = await signer.getAddress();
    const isOperator: boolean = await module.hasRole(
      await module.OPERATOR_ROLE(),
      signerAddress
    );
    if (!isOperator && !dryrun) {
      throw new Error(
        `Signer ${signerAddress} is not an operator of ${MODULE_DEPLOYMENT} at ${module.address}`
      );
    }
    const [safe, poolId, minSqrtPrice, maxAmount0]: [
      string,
      string,
      BigNumber,
      BigNumber
    ] = await Promise.all([
      module.safeContract(),
      module.poolId(),
      module.minSqrtPriceX96(),
      module.maxAmount0(),
    ]);
    // A dry run from a non-operator simulates as the Safe, which also holds
    // the operator role.
    const from = isOperator ? signerAddress : safe;
    const positionManager = new ethers.Contract(
      await module.positionManager(),
      POSITION_MANAGER_ABI,
      provider
    );
    const poolManager = new ethers.Contract(
      await module.poolManager(),
      POOL_MANAGER_ABI,
      provider
    );

    const tokenIds = String(args.tokenIds)
      .split(",")
      .map((id) => BigNumber.from(id.trim()));
    const targets = perPosition(
      args.targetOusd,
      tokenIds.length,
      "--target-ousd"
    );
    const quoteSizes = parseQuoteSizes(args.quoteSize, tokenIds.length);

    const positions = await Promise.all(
      tokenIds.map(async (tokenId, i) => {
        const { poolKey, info } = await positionManager.getPoolAndPositionInfo(
          tokenId
        );
        const [tickLower, tickUpper] = unpackTicks(info);
        return { tokenId, poolKey, tickLower, tickUpper, i };
      })
    );
    const sqrtPriceX96 = BigNumber.from(
      await poolManager.extsload(
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "uint256"],
            [poolId, POOLS_SLOT]
          )
        )
      )
    ).and(BigNumber.from(2).pow(160).sub(1));

    // Deepest range first: a reset swap down to a shallower range would
    // otherwise trade through a deeper one still holding token1.
    positions.sort((a, b) => b.tickLower - a.tickLower);

    for (const { tokenId, poolKey, tickLower, tickUpper, i } of positions) {
      const label = `Position ${tokenId.toString()} [${tickLower}, ${tickUpper}]`;
      const keyHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["tuple(address,address,uint24,int24,address)"],
          [
            [
              poolKey.currency0,
              poolKey.currency1,
              poolKey.fee,
              poolKey.tickSpacing,
              poolKey.hooks,
            ],
          ]
        )
      );
      if (keyHash !== poolId) {
        log.error(`${label}: not in the module's pool, skipping`);
        continue;
      }
      const [token0, token1] = await Promise.all([
        tokenInfo(poolKey.currency0, provider),
        tokenInfo(poolKey.currency1, provider),
      ]);

      // 1. Pricing indicator: the ranges are the Safe's decision, this only
      //    reports where the market would put them. It never blocks the pull.
      const floorTick = bidToTickLower(
        1 - args.redeemCostBps / 10_000,
        poolKey.tickSpacing
      );
      if (tickLower < floorTick) {
        log.warn(
          `${label}: the range starts above the redeem-cost floor (tick ${floorTick}), so it buys ${token1.symbol} for more than redeeming it returns`
        );
      }
      if (!args.skipPricing) {
        try {
          const target = await marketTickLower({
            tickSpacing: poolKey.tickSpacing,
            token0,
            token1,
            quoteSize: quoteSizes[i],
            offsetBps: args.offsetBps,
            redeemCostBps: args.redeemCostBps,
            excludedPools: [poolId.toLowerCase()],
            provider,
            log,
          });
          if (
            pricingAlert({
              current: tickLower,
              target,
              alertTickMove: args.alertTickMove,
            })
          ) {
            log.warn(
              `${label}: the market puts the lower tick at ${target}, ${Math.abs(
                target - tickLower
              )} ticks ${
                target > tickLower
                  ? "deeper (we bid more than needed)"
                  : "closer to par (we bid less than the market)"
              }; the Safe may want to move the range`
            );
          }
        } catch (err) {
          log.warn(`${label}: no pricing, ${(err as Error).message}`);
        }
      }

      // 2. Pull and re-add.
      const sqrtLowerX96 = BigNumber.from(
        getSqrtPriceAtTick(tickLower).toString()
      );
      const sqrtUpperX96 = BigNumber.from(
        getSqrtPriceAtTick(tickUpper).toString()
      );
      const [liquidity, safeToken0, safeToken1]: BigNumber[] =
        await Promise.all([
          positionManager.getPositionLiquidity(tokenId),
          new ethers.Contract(token0.address, ERC20_ABI, provider).balanceOf(
            safe
          ),
          new ethers.Contract(token1.address, ERC20_ABI, provider).balanceOf(
            safe
          ),
        ]);
      const pending = pendingToken1({
        liquidity,
        sqrtPriceX96,
        sqrtLowerX96,
        sqrtUpperX96,
      });
      const resetCap = parseUnits(String(args.resetAmount), token0.decimals);
      const resetAmount0 = resetCap.lt(maxAmount0) ? resetCap : maxAmount0;
      const priceInRange = sqrtPriceX96.gt(sqrtLowerX96);
      // The target in OUSD, capped at what the Safe can fund once the
      // position is pulled, then turned into liquidity on this range.
      const targetToken0 = fundableToken0({
        targetToken0: parseUnits(targets[i], token0.decimals),
        safeToken0,
        positionToken0: positionToken0({
          liquidity,
          sqrtPriceX96,
          sqrtLowerX96,
          sqrtUpperX96,
        }),
        resetAmount0: priceInRange ? resetAmount0 : BigNumber.from(0),
      });
      const plan = planRebalance({
        priceInRange,
        pendingToken1: pending,
        liquidity,
        targetLiquidity: liquidityForToken0({
          amount0: targetToken0,
          sqrtLowerX96,
          sqrtUpperX96,
        }),
        minToken1: parseUnits(String(args.minToken1), token1.decimals),
        safeToken1,
        maxToken1InSafe: parseUnits(
          String(args.maxToken1InSafe),
          token1.decimals
        ),
        resetAmount0,
      });
      const holds = `${formatUnits(pending, token1.decimals)} ${token1.symbol}`;
      if (!plan.send) {
        log.info(`${label}: skipping (${plan.why}, holds ${holds})`);
        continue;
      }
      if (sqrtLowerX96.lt(minSqrtPrice) && plan.resetAmount0.gt(0)) {
        log.warn(
          `${label}: the range bottom is below the module's price floor; pulling without a reset`
        );
        plan.resetAmount0 = BigNumber.from(0);
        plan.liquidityToAdd = BigNumber.from(0);
      }

      // Simulate; if the add would fail (the capped reset cannot bring the
      // price back, or the Safe is short of OUSD), fall back to a pull.
      const callArgs = () => [
        tokenId,
        plan.liquidityToAdd,
        plan.resetAmount0,
        sqrtLowerX96,
      ];
      try {
        await module.callStatic.rebalance(...callArgs(), { from });
      } catch (err) {
        if (plan.liquidityToAdd.isZero() || liquidity.isZero()) {
          log.warn(
            `${label}: rebalance would revert (${(err as Error).message})`
          );
          continue;
        }
        log.warn(
          `${label}: the re-add would revert (${
            (err as Error).message
          }); pulling only. Check the Safe's ${
            token0.symbol
          } and the pool price`
        );
        plan.liquidityToAdd = BigNumber.from(0);
        plan.why = `${plan.why}, re-add skipped`;
      }

      const gas: BigNumber = await module.estimateGas.rebalance(...callArgs(), {
        from,
      });
      if (gas.gt(maxGas)) {
        log.warn(
          `${label}: rebalance estimated at ${gas.toString()} gas, above --max-gas ${maxGas.toString()}; skipping`
        );
        continue;
      }
      log.info(
        `${label}: ${plan.why} (holds ${holds}, add ${formatUnits(
          plan.liquidityToAdd.isZero() ? 0 : targetToken0,
          token0.decimals
        )} ${token0.symbol}, reset ${formatUnits(
          plan.resetAmount0,
          token0.decimals
        )} ${token0.symbol}, ~${gas.toString()} gas)`
      );
      if (dryrun) {
        log.info("Dry run, not sending");
        continue;
      }
      const tx = await module.rebalance(...callArgs(), {
        gasLimit: gas.mul(12).div(10),
      });
      await logTxDetails(tx, `rebalance:${tokenId.toString()}`);
    }
  },
});
