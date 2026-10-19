import { BigNumber, ethers } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { action, types, Logger } from "../lib/action";
import { getOrNull } from "../lib/deployments";
import {
  bidToTickLower,
  curveRate,
  kyberRate,
  tickLowerToBid,
} from "../lib/v4BidPricing";
import type { CurvePool } from "../lib/v4BidPricing";
import { getSqrtPriceAtTick } from "../lib/v4TickMath";
import {
  liquidityForToken0,
  positionToken0,
  positionToken1,
  unpackTicks,
} from "../lib/v4Liquidity";
import addresses from "../../utils/addresses";
import { logTxDetails } from "../../utils/txLogger";

// Descriptor written by `make deploy-mainnet` for
// scripts/deploy/mainnet/010_UniswapV4LiquidityModule.s.sol.
const MODULE_DEPLOYMENT = "UniswapV4LiquidityModule";
// The OUSD/sUSDe module, read only to exclude its pool from the quotes.
const SUSDE_MODULE_DEPLOYMENT = "UniswapV4ERC4626RebalanceModule";

// Narrow inline ABIs: deployment descriptors' ABIs are not a Talos input.
const REBALANCE_PARAMS =
  "tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint256 tokenId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint128 amount0Max, uint128 amount1Max, bool resetZeroForOne, uint128 resetAmountIn, uint160 sqrtPriceLimitX96)";
const MODULE_ABI = [
  "event Rebalanced(bytes32 indexed poolId, uint256 indexed burnedTokenId, uint256 indexed mintedTokenId, int24 tickLower, int24 tickUpper, uint128 liquidity, bool resetZeroForOne, uint128 resetAmountIn)",
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function safeContract() view returns (address)",
  "function poolManager() view returns (address)",
  "function positionManager() view returns (address)",
  "function maxPerDay(address token) view returns (uint256)",
  "function spentOn(uint256 day, address token) view returns (uint256)",
  `function rebalance(${REBALANCE_PARAMS} params) returns (uint256 newTokenId)`,
];
const POSITION_MANAGER_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getPoolAndPositionInfo(uint256 tokenId) view returns (tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, uint256 info)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
];
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];
const POOL_ID_ABI = ["function poolId() view returns (bytes32)"];
const POOL_MANAGER_ABI = [
  "function extsload(bytes32 slot) view returns (bytes32)",
];
// Storage slot of `PoolManager._pools`, as used by v4-core `StateLibrary`.
const POOLS_SLOT = 6;
const CURVE_POOL_ABI = [
  "function coins(uint256 i) view returns (address)",
  "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
];

const BPS = 10_000;
const DECIMALS = 18;
const USDC_DECIMALS = 6;
// Kept back from the OUSD the Safe can put in, for rounding.
const FUND_MARGIN_BPS = 50n;
// A reference this far from par is bad data, not a market to price against.
const MIN_SANE_RATE = 0.9;
const MAX_SANE_RATE = 1.1;

export interface PoolKey {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}

/** The hookless, fee-0 OUSD/USDe pool. OUSD sorts before USDe. */
export function ousdUsdeKey(): PoolKey {
  return {
    currency0: addresses.mainnet.OUSDProxy,
    currency1: addresses.mainnet.USDe,
    fee: 0,
    tickSpacing: 1,
    hooks: ethers.constants.AddressZero,
  };
}

export function poolIdOf(key: PoolKey): string {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["tuple(address,address,uint24,int24,address)"],
      [[key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]]
    )
  );
}

export interface TargetPrice {
  /** OUSD paid per USDe at the top of the range. */
  price: number;
  /** True when the cap binds: the market bids above it. */
  capped: boolean;
}

/**
 * The bid for USDe in OUSD: the market bid in USDC plus the offset, converted
 * into OUSD at the exit rate (what a seller gets for the OUSD), never above
 * par less `capBps`. The cap is in ticks (1.0001^-capBps), so 4 bp is exactly
 * tick 4 rather than a hair below it. All pricing lives here, not in the
 * module.
 */
export function targetPrice({
  bidUsdc,
  exitRate,
  offsetBps,
  capBps,
}: {
  bidUsdc: number;
  exitRate: number;
  offsetBps: number;
  capBps: number;
}): TargetPrice {
  if (!(bidUsdc > 0) || !(exitRate > 0)) {
    throw new Error(`Invalid market rates: ${bidUsdc} bid, ${exitRate} exit`);
  }
  if (!(capBps >= 0)) throw new Error(`Invalid cap ${capBps} bp`);
  const market = (bidUsdc * (1 + offsetBps / BPS)) / exitRate;
  const cap = Math.pow(1.0001, -capBps);
  return market < cap
    ? { price: market, capped: false }
    : { price: cap, capped: true };
}

/**
 * Lowest tick whose price does not exceed `price` (the position pays
 * 1.0001^-tick OUSD per USDe at the range bottom). Refuses a range priced
 * above par, whatever the parameters say.
 */
export function targetTickLower(price: number): number {
  const tick = bidToTickLower(price, 1);
  if (tick < 0) {
    throw new Error(`Tick ${tick} prices USDe above par; refusing`);
  }
  return tick;
}

export interface Plan {
  send: boolean;
  why: string;
}

/**
 * Whether to move: no position, it bought USDe (at least `minToken1`), or the
 * target tick is `maxDrift` ticks away from it.
 */
export function planRebalance({
  tokenId,
  liquidity,
  token1,
  minToken1,
  currentLower,
  targetLower,
  maxDrift,
}: {
  tokenId: bigint;
  liquidity: bigint;
  token1: bigint;
  minToken1: bigint;
  currentLower: number;
  targetLower: number;
  maxDrift: number;
}): Plan {
  if (tokenId === 0n || liquidity === 0n) return { send: true, why: "Mint" };
  if (token1 >= minToken1) return { send: true, why: "Filled" };
  if (Math.abs(targetLower - currentLower) >= maxDrift) {
    return {
      send: true,
      why: targetLower > currentLower ? "Market down" : "Market up",
    };
  }
  return { send: false, why: "In place" };
}

/**
 * OUSD to put in the new position: `target`, capped at what the Safe holds
 * once the position is burned (less the reset and a 0.5% margin), and at what
 * keeps the call's net OUSD outflow (mint + reset - burned OUSD) within the
 * module's daily room.
 */
export function fundableToken0({
  target,
  safeToken0,
  positionToken0: burned0,
  resetAmount0,
  remainingToday,
}: {
  target: bigint;
  safeToken0: bigint;
  positionToken0: bigint;
  resetAmount0: bigint;
  remainingToday: bigint;
}): bigint {
  const held =
    ((safeToken0 + burned0) * (10_000n - FUND_MARGIN_BPS)) / 10_000n -
    resetAmount0;
  const daily =
    ((remainingToday + burned0) * (10_000n - FUND_MARGIN_BPS)) / 10_000n -
    resetAmount0;
  let amount = target;
  for (const cap of [held, daily]) {
    if (cap < amount) amount = cap;
  }
  return amount > 0n ? amount : 0n;
}

/**
 * Reset only when the pool sits above the new range bottom: an OUSD-only mint
 * needs the price at or below it, and v4 reverts a zeroForOne swap whose limit
 * is at or above the price.
 */
export function resetAmount({
  sqrtPriceX96,
  sqrtLimitX96,
  cap,
}: {
  sqrtPriceX96: bigint;
  sqrtLimitX96: bigint;
  cap: bigint;
}): bigint {
  return sqrtPriceX96 > sqrtLimitX96 ? cap : 0n;
}

/**
 * The position the module minted last on `poolId`: the `mintedTokenId` of
 * its latest `Rebalanced` event (0 after a burn-only call), searched
 * backwards in chunks; `fallback` when the module never rebalanced.
 */
async function currentTokenId({
  module,
  provider,
  poolId,
  fallback,
  chunk,
  lookback,
  log,
}: {
  module: ethers.Contract;
  provider: ethers.providers.Provider;
  poolId: string;
  fallback: bigint;
  chunk: number;
  lookback: number;
  log: Logger;
}): Promise<bigint> {
  const latest = await provider.getBlockNumber();
  const floor = Math.max(0, latest - lookback);
  const filter = module.filters.Rebalanced(poolId);
  for (let to = latest; to >= floor; to -= chunk) {
    const from = Math.max(floor, to - chunk + 1);
    const events = await module.queryFilter(filter, from, to);
    if (events.length > 0) {
      const last = events[events.length - 1];
      const minted = BigInt(last.args!.mintedTokenId.toString());
      log.info(
        `Latest Rebalanced at block ${last.blockNumber}: minted ${minted}`
      );
      return minted;
    }
  }
  log.info(
    `No Rebalanced event in the last ${lookback} blocks; using --token-id ${fallback}`
  );
  return fallback;
}

/**
 * Market inputs for `targetPrice`: the KyberSwap bid for USDe in USDC and the
 * OUSD -> USDC exit rate (Curve `get_dy` if KyberSwap fails), our v4 pools
 * excluded. Null when there is no usable market.
 */
async function marketInputs({
  quoteSize,
  exitSize,
  excludedPools,
  provider,
  log,
}: {
  quoteSize: number;
  exitSize: number;
  excludedPools: string[];
  provider: ethers.providers.Provider;
  log: Logger;
}): Promise<{ bidUsdc: number; exitRate: number } | null> {
  const ousd = addresses.mainnet.OUSDProxy;
  const usde = addresses.mainnet.USDe;
  const usdc = addresses.mainnet.USDC;
  const amount = (size: number) => parseUnits(size.toFixed(6), DECIMALS);
  try {
    const bidUsdc = await kyberRate({
      tokenIn: usde,
      tokenOut: usdc,
      amountIn: amount(quoteSize),
      decimalsIn: DECIMALS,
      decimalsOut: USDC_DECIMALS,
      excludedPools,
    });
    let exitRate: number;
    try {
      exitRate = await kyberRate({
        tokenIn: ousd,
        tokenOut: usdc,
        amountIn: amount(exitSize),
        decimalsIn: DECIMALS,
        decimalsOut: USDC_DECIMALS,
        excludedPools,
      });
    } catch (err) {
      log.warn(
        `KyberSwap OUSD -> USDC quote failed (${
          (err as Error).message
        }); using Curve get_dy`
      );
      exitRate = await curveRate({
        pool: new ethers.Contract(
          addresses.mainnet.curve.OUSD_USDC.pool,
          CURVE_POOL_ABI,
          provider
        ) as unknown as CurvePool,
        tokenIn: ousd,
        tokenOut: usdc,
        amountIn: amount(exitSize),
        decimalsIn: DECIMALS,
        decimalsOut: USDC_DECIMALS,
      });
    }
    for (const [label, rate] of [
      ["USDC/USDe", bidUsdc],
      ["USDC/OUSD", exitRate],
    ] as const) {
      if (rate < MIN_SANE_RATE || rate > MAX_SANE_RATE) {
        throw new Error(`${label} quote ${rate} is outside the sane band`);
      }
    }
    return { bidUsdc, exitRate };
  } catch (err) {
    log.warn(`No market price: ${(err as Error).message}`);
    return null;
  }
}

action({
  name: "ousdUsdeV4Rebalance",
  description:
    "Keep the OUSD/USDe Uniswap v4 position on one tick just above the KyberSwap bid for USDe, capped below par, via UniswapV4LiquidityModule: burn it, reset the price and mint a fresh one, so what it bought cannot be bought back",
  chains: [1],
  params: (t) => {
    t.addOptionalParam(
      "capBps",
      "Never pay more than par less this for USDe, in bp of OUSD",
      4,
      types.float
    );
    t.addOptionalParam(
      "offsetBps",
      "How far above the KyberSwap bid to price, in bp",
      1,
      types.float
    );
    t.addOptionalParam(
      "quoteSize",
      "USDe sold in the KyberSwap reference quote, in whole units",
      10000,
      types.float
    );
    t.addOptionalParam(
      "exitSize",
      "OUSD sold in the OUSD -> USDC exit quote, in whole units",
      10000,
      types.float
    );
    t.addOptionalParam("width", "Width of the range, in ticks", 1, types.int);
    t.addOptionalParam(
      "maxDrift",
      "Move the range once its bottom is this many ticks from the target",
      1,
      types.int
    );
    t.addOptionalParam(
      "minToken1",
      "Smallest USDe held by the position (whole units) worth a pull",
      500,
      types.float
    );
    t.addOptionalParam(
      "targetOusd",
      "OUSD to put in the position, in whole units, capped at what the Safe and the module allow",
      50000,
      types.float
    );
    t.addOptionalParam(
      "resetAmount",
      "Max OUSD the reset swap may sell, in whole units",
      100,
      types.float
    );
    t.addOptionalParam(
      "tokenId",
      "Position to manage before the module's first Rebalanced event",
      "457273",
      types.string
    );
    t.addOptionalParam(
      "lookbackBlocks",
      "How far back to look for the module's latest Rebalanced event",
      500_000,
      types.int
    );
    t.addOptionalParam(
      "logChunk",
      "Block range per eth_getLogs call",
      50_000,
      types.int
    );
    t.addOptionalParam(
      "maxGas",
      "Skip a rebalance estimated above this gas",
      5_000_000,
      types.int
    );
    t.addOptionalParam(
      "module",
      "Module address, overriding the deployment descriptor (forks)",
      "",
      types.string
    );
    t.addFlag("dryrun", "Simulate, but do not send any transaction");
  },
  run: async ({ signer, args, log }) => {
    const dryrun = !!args.dryrun;
    const provider = signer.provider!;

    const moduleAddress =
      args.module || getOrNull(MODULE_DEPLOYMENT)?.address || "";
    if (!moduleAddress) {
      throw new Error(
        `${MODULE_DEPLOYMENT} is not deployed: deployments/mainnet/${MODULE_DEPLOYMENT}.json is missing (or pass --module)`
      );
    }
    const module = new ethers.Contract(moduleAddress, MODULE_ABI, signer);
    const key = ousdUsdeKey();
    const poolId = poolIdOf(key);

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
    const safe: string = await module.safeContract();
    // A dry run from a non-operator simulates as the Safe, which also holds
    // the operator role.
    const from = isOperator ? signerAddress : safe;
    const positionManager = new ethers.Contract(
      await module.positionManager(),
      POSITION_MANAGER_ABI,
      provider
    );

    // 1. Current position.
    const tokenId = await currentTokenId({
      module,
      provider,
      poolId,
      fallback: BigInt(args.tokenId),
      chunk: args.logChunk,
      lookback: args.lookbackBlocks,
      log,
    });
    const poolManager = new ethers.Contract(
      await module.poolManager(),
      POOL_MANAGER_ABI,
      provider
    );
    const slot0 = await poolManager.extsload(
      ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["bytes32", "uint256"],
          [poolId, POOLS_SLOT]
        )
      )
    );
    const sqrtPriceX96 = BigInt(slot0) & ((1n << 160n) - 1n);
    let tickLower = 0;
    let tickUpper = 0;
    let liquidity = 0n;
    let token0 = 0n;
    let token1 = 0n;
    if (tokenId !== 0n) {
      const owner: string = await positionManager.ownerOf(tokenId);
      if (owner.toLowerCase() !== safe.toLowerCase()) {
        throw new Error(
          `Position ${tokenId} is owned by ${owner}, not ${safe}`
        );
      }
      const { poolKey, info } = await positionManager.getPoolAndPositionInfo(
        tokenId
      );
      if (
        poolIdOf({
          currency0: poolKey.currency0,
          currency1: poolKey.currency1,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks,
        }) !== poolId
      ) {
        throw new Error(`Position ${tokenId} is not in the OUSD/USDe pool`);
      }
      [tickLower, tickUpper] = unpackTicks(BigInt(info.toString()));
      liquidity = BigInt(
        (await positionManager.getPositionLiquidity(tokenId)).toString()
      );
      const sqrtLower = getSqrtPriceAtTick(tickLower);
      const sqrtUpper = getSqrtPriceAtTick(tickUpper);
      token0 = positionToken0(liquidity, sqrtPriceX96, sqrtLower, sqrtUpper);
      token1 = positionToken1(liquidity, sqrtPriceX96, sqrtLower, sqrtUpper);
    }
    const label = `Position ${tokenId} [${tickLower}, ${tickUpper}]`;
    const holds = `${formatUnits(token0, DECIMALS)} OUSD, ${formatUnits(
      token1,
      DECIMALS
    )} USDe`;

    // 2. Target tick: the market bid, capped below par. Without a market,
    //    keep the current tick (a fill is still pulled and re-armed).
    const susdeModule = getOrNull(SUSDE_MODULE_DEPLOYMENT)?.address;
    const excludedPools = [poolId.toLowerCase()];
    if (susdeModule) {
      excludedPools.push(
        (
          (await new ethers.Contract(
            susdeModule,
            POOL_ID_ABI,
            provider
          ).poolId()) as string
        ).toLowerCase()
      );
    }
    const market = await marketInputs({
      quoteSize: args.quoteSize,
      exitSize: args.exitSize,
      excludedPools,
      provider,
      log,
    });
    let targetLower: number;
    if (market) {
      const target = targetPrice({
        bidUsdc: market.bidUsdc,
        exitRate: market.exitRate,
        offsetBps: args.offsetBps,
        capBps: args.capBps,
      });
      targetLower = targetTickLower(target.price);
      const bps = (x: number) => ((x - 1) * BPS).toFixed(2);
      log.info(
        `KyberSwap: ${market.bidUsdc.toFixed(
          6
        )} USDC/USDe, exit ${market.exitRate.toFixed(
          6
        )} USDC/OUSD; target ${target.price.toFixed(6)} OUSD/USDe (${bps(
          target.price
        )} bp vs par)${
          target.capped ? `, capped at par - ${args.capBps} bp` : ""
        } -> tick ${targetLower}, top bid ${tickLowerToBid(targetLower).toFixed(
          6
        )}`
      );
      if (!target.capped) {
        log.warn(
          `The market bids USDe below the cap (${bps(
            target.price
          )} bp vs par): following it down to tick ${targetLower}`
        );
      }
    } else if (tokenId !== 0n && liquidity > 0n) {
      targetLower = tickLower;
      log.warn(`${label}: no market price; keeping tick ${tickLower}`);
    } else {
      log.warn("No market price and no position to keep; skipping");
      return;
    }

    const plan = planRebalance({
      tokenId,
      liquidity,
      token1,
      minToken1: BigInt(
        parseUnits(String(args.minToken1), DECIMALS).toString()
      ),
      currentLower: tickLower,
      targetLower,
      maxDrift: market ? args.maxDrift : Number.MAX_SAFE_INTEGER,
    });
    if (!plan.send) {
      log.info(`${label}: skipping (${plan.why}, holds ${holds})`);
      return;
    }

    // 3. Size the move.
    const newLower = targetLower;
    const newUpper = targetLower + args.width;
    const sqrtLimitX96 = getSqrtPriceAtTick(newLower);
    const ousd = new ethers.Contract(key.currency0, ERC20_ABI, provider);
    const day = Math.floor(Date.now() / 1000 / 86400);
    const [safeToken0, maxPerDay, spent] = await Promise.all([
      ousd.balanceOf(safe),
      module.maxPerDay(key.currency0),
      module.spentOn(day, key.currency0),
    ]);
    const cap = BigInt(maxPerDay.toString());
    const used = BigInt(spent.toString());
    const remainingToday = cap > used ? cap - used : 0n;
    const reset = resetAmount({
      sqrtPriceX96,
      sqrtLimitX96,
      cap: BigInt(parseUnits(String(args.resetAmount), DECIMALS).toString()),
    });
    const target0 = BigInt(
      parseUnits(String(args.targetOusd), DECIMALS).toString()
    );
    const amount0 = fundableToken0({
      target: target0,
      safeToken0: BigInt(safeToken0.toString()),
      positionToken0: token0,
      resetAmount0: reset,
      remainingToday,
    });
    const newLiquidity = liquidityForToken0(
      amount0,
      sqrtLimitX96,
      getSqrtPriceAtTick(newUpper)
    );
    if (amount0 * 10n < target0) {
      log.warn(
        `Only ${formatUnits(
          amount0,
          DECIMALS
        )} OUSD available of --target-ousd ${
          args.targetOusd
        } (Safe ${formatUnits(
          BigInt(safeToken0.toString()),
          DECIMALS
        )}, module room today ${formatUnits(remainingToday, DECIMALS)})`
      );
    }

    // 4. Simulate, then send.
    const params = {
      key,
      tokenId: BigNumber.from(tokenId.toString()),
      tickLower: newLower,
      tickUpper: newUpper,
      liquidity: BigNumber.from(newLiquidity.toString()),
      amount0Max: BigNumber.from(
        (newLiquidity > 0n ? amount0 + amount0 / 1000n + 1n : 0n).toString()
      ),
      amount1Max: 0,
      resetZeroForOne: true,
      resetAmountIn: BigNumber.from(
        (newLiquidity > 0n ? reset : 0n).toString()
      ),
      sqrtPriceLimitX96: BigNumber.from(sqrtLimitX96.toString()),
    };
    try {
      await module.callStatic.rebalance(params, { from });
    } catch (err) {
      log.error(`${label}: rebalance would revert (${(err as Error).message})`);
      return;
    }
    const gas: BigNumber = await module.estimateGas.rebalance(params, {
      from,
    });
    if (gas.gt(args.maxGas)) {
      log.warn(
        `${label}: rebalance estimated at ${gas.toString()} gas, above --max-gas ${
          args.maxGas
        }; skipping`
      );
      return;
    }
    log.info(
      `${label}: ${
        plan.why
      } (holds ${holds}) -> [${newLower}, ${newUpper}] with ${formatUnits(
        amount0,
        DECIMALS
      )} OUSD, liquidity ${newLiquidity}, reset ${formatUnits(
        BigInt(params.resetAmountIn.toString()),
        DECIMALS
      )} OUSD, ~${gas.toString()} gas`
    );
    if (dryrun) {
      log.info("Dry run, not sending");
      return;
    }
    const tx = await module.rebalance(params, {
      gasLimit: gas.mul(12).div(10),
    });
    await logTxDetails(tx, `rebalance:${tokenId}`);
  },
});
