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
import { logTxDetails } from "../../utils/txLogger";
import addresses from "../../utils/addresses";

// Committed descriptor written by `make deploy-mainnet` for
// scripts/deploy/mainnet/008_UniswapV4RebalanceModule.s.sol.
const MODULE_DEPLOYMENT = "UniswapV4RebalanceModule";

// Narrow inline ABI: the deployment descriptor's ABI is not a Talos input.
const MODULE_ABI = [
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function safeContract() view returns (address)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function configuredTokenIds() view returns (uint256[])",
  "function rebalanceStatus(uint256 tokenId) view returns (bool needed, uint8 reason)",
  "function pendingToken1(uint256 tokenId) view returns (uint256)",
  "function getPosition(uint256 tokenId) view returns (tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, bytes32 poolId, int24 tickLower, int24 tickUpper, uint160 sqrtPriceLowerX96, uint160 sqrtPriceUpperX96, tuple(uint128 targetLiquidity, uint128 maxAmount0, uint128 maxResetAmount0, uint256 maxToken1InSafe) limits))",
  "function rebalance(uint256 tokenId) returns (bool added)",
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Fallback for the OUSD -> USDC exit leg when KyberSwap fails.
const CURVE_POOL_ABI = [
  "function coins(uint256 i) view returns (address)",
  "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
];

const USDC_DECIMALS = 6;
// A reference outside this band is bad data, not a market to report.
const MIN_SANE_RATE = 0.9;
const MAX_SANE_RATE = 1.1;

// IUniswapV4RebalanceModule.Reason, in declaration order.
export const REASONS = [
  "None",
  "NotConfigured",
  "Paused",
  "Balanced",
  "PullNeeded",
  "ReAddNeeded",
  "PriceInRange",
  "ExposureCap",
  "AddFailed",
] as const;

const PULL_NEEDED = REASONS.indexOf("PullNeeded");

/**
 * Whether to send `rebalance` for one position, from the module's own status.
 * A pull is sent once the position holds at least `minToken1`, so the schedule
 * does not spend gas on dust. A re-add (no pull) is always worth sending; the
 * caller still simulates it and skips if it would add nothing.
 */
export function decideRebalance({
  needed,
  reason,
  pendingToken1,
  minToken1,
}: {
  needed: boolean;
  reason: number;
  pendingToken1: BigNumber;
  minToken1: BigNumber;
}): { send: boolean; why: string } {
  const label = REASONS[reason] ?? `Reason(${reason})`;
  if (!needed) return { send: false, why: label };
  if (reason === PULL_NEEDED && pendingToken1.lt(minToken1)) {
    return { send: false, why: "Dust" };
  }
  return { send: true, why: label };
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Position = any;

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
 * Market-implied lower tick for a position, from KyberSwap quotes at
 * `quoteSize`: where the range should start to beat the market by the offset
 * without bidding above what redeeming 1:1 returns.
 */
async function marketTickLower({
  position,
  token0,
  token1,
  quoteSize,
  offsetBps,
  redeemCostBps,
  excludedPools,
  provider,
  log,
}: {
  position: Position;
  token0: Token;
  token1: Token;
  quoteSize: number;
  offsetBps: number;
  redeemCostBps: number;
  excludedPools: string[];
  provider: ethers.providers.Provider;
  log: Logger;
}): Promise<number> {
  const quote = (token: Token) =>
    kyberRate({
      tokenIn: token.address,
      tokenOut: addresses.mainnet.USDC,
      amountIn: parseUnits(String(quoteSize), token.decimals),
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
        amountIn: parseUnits(String(quoteSize), token0.decimals),
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
  const tick = bidToTickLower(bid, position.key.tickSpacing);

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
      "quoteSize",
      "Size of the reference quote, in token1 units (USDe). One value, or one per configured position in configuredTokenIds order, comma separated",
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
      "minToken1",
      "Smallest amount of the bought token (whole units) worth a pull",
      10,
      types.float
    );
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
    // A dry run from a non-operator simulates as the Safe, which also holds
    // the operator role.
    const from: string = isOperator
      ? signerAddress
      : await module.safeContract();

    const tokenIds: BigNumber[] = await module.configuredTokenIds();
    if (tokenIds.length === 0) {
      log.info(`No position configured on ${module.address}`);
      return;
    }
    const positions: Position[] = await Promise.all(
      tokenIds.map((id) => module.getPosition(id))
    );
    const quoteSizes = parseQuoteSizes(args.quoteSize, tokenIds.length);
    const excludedPools = [
      ...new Set(positions.map((p) => String(p.poolId).toLowerCase())),
    ];

    // Deepest range first: a reset swap down to a shallower range would
    // otherwise trade through a deeper one still holding token1.
    const order = positions
      .map((_, i) => i)
      .sort((a, b) => positions[b].tickLower - positions[a].tickLower);

    for (const i of order) {
      const tokenId = tokenIds[i];
      const position = positions[i];
      const [token0, token1] = await Promise.all([
        tokenInfo(position.key.currency0, provider),
        tokenInfo(position.key.currency1, provider),
      ]);
      const label = `Position ${tokenId.toString()} [${position.tickLower}, ${
        position.tickUpper
      }]`;

      // 1. Pricing indicator: the ranges are the Safe's decision, this only
      //    reports where the market would put them. It never blocks the pull.
      const floorTick = bidToTickLower(
        1 - args.redeemCostBps / 10_000,
        position.key.tickSpacing
      );
      if (position.tickLower < floorTick) {
        log.warn(
          `${label}: the range starts above the redeem-cost floor (tick ${floorTick}), so it buys ${token1.symbol} for more than redeeming it returns`
        );
      }
      if (!args.skipPricing) {
        try {
          const target = await marketTickLower({
            position,
            token0,
            token1,
            quoteSize: quoteSizes[i],
            offsetBps: args.offsetBps,
            redeemCostBps: args.redeemCostBps,
            excludedPools,
            provider,
            log,
          });
          if (
            pricingAlert({
              current: position.tickLower,
              target,
              alertTickMove: args.alertTickMove,
            })
          ) {
            log.warn(
              `${label}: the market puts the lower tick at ${target}, ${Math.abs(
                target - position.tickLower
              )} ticks ${
                target > position.tickLower
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
      const [{ needed, reason }, pendingToken1]: [
        { needed: boolean; reason: number },
        BigNumber
      ] = await Promise.all([
        module.rebalanceStatus(tokenId),
        module.pendingToken1(tokenId),
      ]);
      const pending = `${formatUnits(pendingToken1, token1.decimals)} ${
        token1.symbol
      }`;

      const { send, why } = decideRebalance({
        needed,
        reason,
        pendingToken1,
        minToken1: parseUnits(String(args.minToken1), token1.decimals),
      });
      if (!send) {
        log.info(`${label}: skipping (${why}, holds ${pending})`);
        continue;
      }

      // A re-add with no pull that would still be skipped (the reset swap
      // cannot reach the range bottom, or the Safe cannot fund the add) only
      // burns gas, so simulate it first.
      const added: boolean = await module.callStatic.rebalance(tokenId, {
        from,
      });
      if (!added && reason !== PULL_NEEDED) {
        log.warn(
          `${label}: ${why} but the re-add would be skipped; check the Safe's ${token0.symbol} and the pool price`
        );
        continue;
      }

      const gas: BigNumber = await module.estimateGas.rebalance(tokenId, {
        from,
      });
      if (gas.gt(maxGas)) {
        log.warn(
          `${label}: rebalance estimated at ${gas.toString()} gas, above --max-gas ${maxGas.toString()}; skipping`
        );
        continue;
      }

      log.info(
        `${label}: rebalancing (${why}, holds ${pending}, re-add ${
          added ? "expected" : "skipped"
        }, ~${gas.toString()} gas)`
      );
      if (dryrun) {
        log.info("Dry run, not sending");
        continue;
      }

      const tx = await module.rebalance(tokenId, {
        gasLimit: gas.mul(12).div(10),
      });
      await logTxDetails(tx, `rebalance:${tokenId.toString()}`);
    }
  },
});
