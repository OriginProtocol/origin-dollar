import { BigNumber, ethers } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { action, types, Logger } from "../lib/action";
import { getOrNull } from "../lib/deployments";
import { getSqrtPriceAtTick } from "../lib/v4TickMath";
import { logTxDetails } from "../../utils/txLogger";

// Descriptor written by `make deploy-mainnet` for
// scripts/deploy/mainnet/009_UniswapV4ERC4626RebalanceModule.s.sol.
const MODULE_DEPLOYMENT = "UniswapV4ERC4626RebalanceModule";

// Narrow inline ABIs: deployment descriptors' ABIs are not a Talos input.
const MODULE_ABI = [
  "event Rebalanced(uint256 indexed burnedTokenId, uint256 indexed mintedTokenId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint128 resetAmount0)",
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function safeContract() view returns (address)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function positionManager() view returns (address)",
  "function currency0() view returns (address)",
  "function currency1() view returns (address)",
  "function poolId() view returns (bytes32)",
  "function maxAmount0() view returns (uint128)",
  "function navPriceX192() view returns (uint256)",
  "function navFloorX192() view returns (uint256)",
  "function poolSqrtPriceX96() view returns (uint160)",
  "function rebalance(uint256 tokenId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint128 resetAmount0, uint160 sqrtPriceLimitX96) returns (uint256 newTokenId)",
];
const POSITION_MANAGER_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getPoolAndPositionInfo(uint256 tokenId) view returns (tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, uint256 info)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
];
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

const Q96 = 1n << 96n;
// Both currencies have 18 decimals, which the module requires.
const DECIMALS = 18;
// Kept back from the OUSD the Safe can put in, for rounding.
const FUND_MARGIN_BPS = 50n;

/** Smallest integer s with s * s >= n. */
export function ceilSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("Negative");
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  // Newton from the float estimate, then fix the last unit.
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x - 1n && y <= x + 1n) {
      x = y;
      break;
    }
    x = y;
  }
  while (x * x > n) x -= 1n;
  while (x * x < n) x += 1n;
  return x;
}

export interface NavRange {
  /** Fractional tick of the floor, for logs. */
  navTick: number;
  /** Smallest sqrtPriceX96 at or above the floor: the reset swap's limit. */
  sqrtLimitX96: bigint;
  /** Smallest tick whose price is at or above the floor. */
  tickLower: number;
  tickUpper: number;
}

/**
 * Target range from the module's floor (`navFloorX192`: the NAV less its
 * tolerance, the square of a sqrtPriceX96): [ceil(floorTick), + width].
 */
export function navRange(navPriceX192: bigint, width: number): NavRange {
  if (!Number.isInteger(width) || width < 1) {
    throw new Error(`Invalid width ${width}`);
  }
  const sqrtLimitX96 = ceilSqrt(navPriceX192);
  const navTick = Math.log(Number(navPriceX192) / 2 ** 192) / Math.log(1.0001);
  // getSqrtPriceAtTick(t) >= sqrtLimit <=> its square >= the NAV.
  let tick = Math.floor(navTick);
  while (getSqrtPriceAtTick(tick) >= sqrtLimitX96) tick -= 1;
  while (getSqrtPriceAtTick(tick) < sqrtLimitX96) tick += 1;
  return { navTick, sqrtLimitX96, tickLower: tick, tickUpper: tick + width };
}

/** sUSDe a position holds: L * (min(P, Pu) - Pl) / Q96 when P > Pl. */
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

/** OUSD a position holds: L * (Pu - max(P, Pl)) * Q96 / (max(P, Pl) * Pu). */
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

/** Liquidity an OUSD-only position on [Pl, Pu] gets from `amount0` OUSD. */
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

/**
 * OUSD to put in the new position: `target`, capped at what the Safe holds
 * once the position is burned (its OUSD plus the position's), less the reset
 * and a 0.5% margin.
 */
export function fundableToken0({
  target,
  safeToken0,
  positionToken0,
  resetAmount0,
}: {
  target: bigint;
  safeToken0: bigint;
  positionToken0: bigint;
  resetAmount0: bigint;
}): bigint {
  const available =
    ((safeToken0 + positionToken0) * (10_000n - FUND_MARGIN_BPS)) / 10_000n -
    resetAmount0;
  if (available <= 0n) return 0n;
  return available < target ? available : target;
}

export interface Plan {
  send: boolean;
  why: string;
}

/**
 * Whether to move the position to the target range: it has none, it sold
 * OUSD (holds at least `minToken1` sUSDe), it sits below the NAV, or the NAV
 * has drifted `maxDrift` ticks below its bottom.
 */
export function planRebalance({
  tokenId,
  liquidity,
  tickLower,
  token1,
  minToken1,
  targetLower,
  maxDrift,
}: {
  tokenId: bigint;
  liquidity: bigint;
  tickLower: number;
  token1: bigint;
  minToken1: bigint;
  targetLower: number;
  maxDrift: number;
}): Plan {
  if (tokenId === 0n || liquidity === 0n) return { send: true, why: "Mint" };
  if (token1 >= minToken1) return { send: true, why: "Filled" };
  if (tickLower < targetLower) return { send: true, why: "Below NAV" };
  if (tickLower - targetLower >= maxDrift) return { send: true, why: "Drift" };
  return { send: false, why: "In place" };
}

/**
 * Reset only when the pool sits above the limit: v4 reverts a zeroForOne
 * swap whose limit is at or above the price.
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

/** int24 tickLower and tickUpper packed in PositionInfo (bits 8-31, 32-55). */
export function unpackTicks(info: bigint): [number, number] {
  const tick = (shift: bigint) => {
    const raw = Number((info >> shift) & 0xffffffn);
    return raw >= 0x800000 ? raw - 0x1000000 : raw;
  };
  return [tick(8n), tick(32n)];
}

/**
 * The position the module minted last: the `mintedTokenId` of its latest
 * `Rebalanced` event (0 after a burn-only call), searched backwards in
 * chunks; `fallback` when the module never rebalanced.
 */
async function currentTokenId({
  module,
  provider,
  fallback,
  chunk,
  lookback,
  log,
}: {
  module: ethers.Contract;
  provider: ethers.providers.Provider;
  fallback: bigint;
  chunk: number;
  lookback: number;
  log: Logger;
}): Promise<bigint> {
  const latest = await provider.getBlockNumber();
  const floor = Math.max(0, latest - lookback);
  const filter = module.filters.Rebalanced();
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

action({
  name: "ousdSusdeV4Rebalance",
  description:
    "Keep the OUSD/sUSDe Uniswap v4 position OUSD-only and just above the sUSDe NAV, via UniswapV4ERC4626RebalanceModule: burn it, reset the price to the NAV and mint a fresh range",
  chains: [1],
  params: (t) => {
    t.addOptionalParam(
      "tokenId",
      "Position to manage when the module has no Rebalanced event yet",
      "457274",
      types.string
    );
    t.addOptionalParam(
      "width",
      "Width of the new range, in ticks",
      5,
      types.int
    );
    t.addOptionalParam(
      "maxDrift",
      "Move the range once its bottom is this many ticks above the NAV's",
      2,
      types.int
    );
    t.addOptionalParam(
      "minToken1",
      "Smallest sUSDe held by the position (whole units) worth a move",
      10,
      types.float
    );
    t.addOptionalParam(
      "targetOusd",
      "OUSD to put in the new position, in whole units, capped at what the Safe can fund",
      20000,
      types.float
    );
    t.addOptionalParam(
      "resetAmount",
      "Max OUSD the reset swap may sell, in whole units (capped by the module)",
      100,
      types.float
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
    const [safe, poolId, currency0, maxAmount0, navX192, floorX192, sqrtPrice] =
      await Promise.all([
        module.safeContract() as Promise<string>,
        module.poolId() as Promise<string>,
        module.currency0() as Promise<string>,
        module.maxAmount0() as Promise<BigNumber>,
        module.navPriceX192() as Promise<BigNumber>,
        module.navFloorX192() as Promise<BigNumber>,
        module.poolSqrtPriceX96() as Promise<BigNumber>,
      ]);
    // A dry run from a non-operator simulates as the Safe, which also holds
    // the operator role.
    const from = isOperator ? signerAddress : safe;
    const positionManager = new ethers.Contract(
      await module.positionManager(),
      POSITION_MANAGER_ABI,
      provider
    );
    const sqrtPriceX96 = BigInt(sqrtPrice.toString());

    // 1. Target range from the module's floor (the NAV less its tolerance).
    const target = navRange(BigInt(floorX192.toString()), args.width);
    const navTick =
      Math.log(Number(BigInt(navX192.toString())) / 2 ** 192) /
      Math.log(1.0001);
    const poolTick =
      (2 * Math.log(Number(sqrtPriceX96) / 2 ** 96)) / Math.log(1.0001);
    log.info(
      `NAV tick ${navTick.toFixed(2)}, floor tick ${target.navTick.toFixed(
        2
      )}, pool tick ${poolTick.toFixed(2)}; target [${target.tickLower}, ${
        target.tickUpper
      }]`
    );

    // 2. Current position.
    const tokenId = await currentTokenId({
      module,
      provider,
      fallback: BigInt(args.tokenId),
      chunk: args.logChunk,
      lookback: args.lookbackBlocks,
      log,
    });
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
        throw new Error(`Position ${tokenId} is not in the module's pool`);
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
    )} sUSDe`;

    const plan = planRebalance({
      tokenId,
      liquidity,
      tickLower,
      token1,
      minToken1: BigInt(
        parseUnits(String(args.minToken1), DECIMALS).toString()
      ),
      targetLower: target.tickLower,
      maxDrift: args.maxDrift,
    });
    if (!plan.send) {
      log.info(`${label}: skipping (${plan.why}, holds ${holds})`);
      return;
    }

    // 3. Size the move.
    const cap = BigInt(
      parseUnits(String(args.resetAmount), DECIMALS).toString()
    );
    const max0 = BigInt(maxAmount0.toString());
    const reset = resetAmount({
      sqrtPriceX96,
      sqrtLimitX96: target.sqrtLimitX96,
      cap: cap < max0 ? cap : max0,
    });
    if (reset === 0n && sqrtPriceX96 < target.sqrtLimitX96) {
      log.warn(
        `${label}: the pool price is below the module's NAV floor and the module can only push it down; the mint will revert`
      );
    }
    const safeToken0 = BigInt(
      (
        await new ethers.Contract(currency0, ERC20_ABI, provider).balanceOf(
          safe
        )
      ).toString()
    );
    let amount0 = fundableToken0({
      target: BigInt(parseUnits(String(args.targetOusd), DECIMALS).toString()),
      safeToken0,
      positionToken0: token0,
      resetAmount0: reset,
    });
    if (amount0 > max0) amount0 = max0;
    const newLiquidity = liquidityForToken0(
      amount0,
      getSqrtPriceAtTick(target.tickLower),
      getSqrtPriceAtTick(target.tickUpper)
    );
    if (newLiquidity === 0n) {
      log.warn(`${label}: the Safe has no OUSD to mint with; skipping`);
      return;
    }

    // 4. Simulate, then send.
    const callArgs = [
      tokenId,
      target.tickLower,
      target.tickUpper,
      newLiquidity,
      reset,
      target.sqrtLimitX96,
    ].map((v) => (typeof v === "bigint" ? BigNumber.from(v.toString()) : v));
    try {
      await module.callStatic.rebalance(...callArgs, { from });
    } catch (err) {
      log.error(`${label}: rebalance would revert (${(err as Error).message})`);
      return;
    }
    const gas: BigNumber = await module.estimateGas.rebalance(...callArgs, {
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
      `${label}: ${plan.why} (holds ${holds}) -> [${target.tickLower}, ${
        target.tickUpper
      }] with ${formatUnits(
        amount0,
        DECIMALS
      )} OUSD, liquidity ${newLiquidity}, reset ${formatUnits(
        reset,
        DECIMALS
      )} OUSD to ${target.sqrtLimitX96}, ~${gas.toString()} gas`
    );
    if (dryrun) {
      log.info("Dry run, not sending");
      return;
    }
    const tx = await module.rebalance(...callArgs, {
      gasLimit: gas.mul(12).div(10),
    });
    await logTxDetails(tx, `rebalance:${tokenId}`);
  },
});
