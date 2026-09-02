import { BigNumber, ethers } from "ethers";
import { action, types } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";
import { loadConfig } from "../../utils/ogn-buyback-config";
import { keyValueStoreLocalClient } from "../../utils/localKeyValueStore";
import addresses from "../../utils/addresses";

/**
 * Sets the xOGN reward rate from the OGN the protocol has actually bought.
 *
 * The rate is proposed here and enforced on chain: SetXOGNRewardRateModule
 * re-checks the bounds, the step limit and the runway before it writes anything,
 * so a bug here cannot produce an arbitrary rate.
 */

/** CoW Protocol GPv2Settlement. Buys land in the reward source from this address. */
const COW_SETTLEMENT = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";

const TRANSFER_TOPIC = ethers.utils.id("Transfer(address,address,uint256)");

const REWARDS_SOURCE_ABI = [
  "function rewardConfig() view returns (uint64 lastCollect, uint192 rewardsPerSecond)",
  "function previewRewards() view returns (uint256)",
];

const STORE_PATH = ".store/setXOGNRewardRate.json";

/** Mainnet averages ~12s blocks. Only used to size the scan window. */
const SECONDS_PER_BLOCK = 12;

type Fill = { block: number; id: string; amount: string };

action({
  name: "setXOGNRewardRate",
  description: "Set the xOGN reward rate from measured OGN buybacks",
  chains: [1],
  params: (t) => {
    t.addOptionalParam(
      "dryrun",
      "Compute and report the rate without broadcasting",
      false,
      types.boolean
    );
  },
  run: async ({ signer, args, chainId, log }) => {
    const dryrun = !!args.dryrun;
    const config = loadConfig();
    const { windowDays, minRunwaySeconds, maxRunwaySeconds, deadbandBps } =
      config.script;

    const provider = signer.provider!;
    const module = await getContract("SetXOGNRewardRateModule");
    const rewardsSource = await getContractAt(
      REWARDS_SOURCE_ABI,
      addresses.mainnet.OGNRewardsSource
    );
    const ogn = await getContractAt(
      ["function balanceOf(address) view returns (uint256)"],
      addresses.mainnet.OGN
    );

    // --- Current on-chain state. Never read the rate from the store: the chain
    //     is the only place it is authoritative.
    const [, currentRate] = await rewardsSource.rewardConfig();
    const balance: BigNumber = await ogn.balanceOf(
      addresses.mainnet.OGNRewardsSource
    );
    const owed: BigNumber = await rewardsSource.previewRewards();
    const available = balance.sub(owed);

    log.info(
      `Reward source: ${fmt(balance)} OGN held, ${fmt(owed)} already owed, ` +
        `${fmt(available)} available`
    );
    log.info(`Current rate: ${fmt(currentRate)} OGN/sec`);

    // --- Measured inflow
    const windowSeconds = windowDays * 86400;
    const windowBlocks = Math.floor(windowSeconds / SECONDS_PER_BLOCK);
    const latestBlock = await provider.getBlockNumber();

    const inflow = await measureInflow({
      provider,
      latestBlock,
      windowBlocks,
      config,
      chainId,
      log,
    });

    log.info(
      `CoW inflow over ${windowDays}d: ${fmt(inflow)} OGN ` +
        `(${fmt(inflow.div(windowSeconds))} OGN/sec)`
    );

    // --- Rate
    const baseRate = inflow.div(windowSeconds);
    const floorRate = available.div(maxRunwaySeconds);
    const ceilRate = available.div(minRunwaySeconds);

    let rate = clamp(baseRate, floorRate, ceilRate);
    if (!rate.eq(baseRate)) {
      log.info(
        `Runway band moved the rate from ${fmt(baseRate)} to ${fmt(rate)} ` +
          `(band ${fmt(floorRate)}..${fmt(ceilRate)} OGN/sec)`
      );
    }

    const minRate: BigNumber = await module.minRate();
    const maxRate: BigNumber = await module.maxRate();
    const clamped = clamp(rate, minRate, maxRate);
    if (!clamped.eq(rate)) {
      log.warn(
        `Rate limits moved the rate from ${fmt(rate)} to ${fmt(clamped)}. ` +
          `Sustained clamping here means the bounds no longer fit reality.`
      );
      rate = clamped;
    }

    // The module measures the step against a checkpoint that refreshes once per
    // `stepPeriod`, not against the live rate. Clamping against `currentRate`
    // would propose a rate the module rejects whenever a run repeats inside a
    // period -- a retry after a failure, most likely -- so mirror its baseline.
    const maxStepBps: number = await module.maxStepBps();
    const checkpointRate: BigNumber = await module.checkpointRate();
    // uint64 decodes to a BigNumber, unlike the uint32/uint16 bounds above.
    const checkpointTime: BigNumber = await module.checkpointTime();
    const stepPeriod: number = await module.stepPeriod();

    // Compare against chain time, not the local clock: the module checks
    // `block.timestamp`, and a skewed host would otherwise pick the wrong
    // baseline and propose a rate that reverts.
    const chainNow = (await provider.getBlock(latestBlock)).timestamp;
    const periodEnd = checkpointTime.add(stepPeriod);
    const periodElapsed = periodEnd.lte(chainNow);
    const baseline = periodElapsed ? currentRate : checkpointRate;

    log.info(
      periodElapsed
        ? `Step period has elapsed; baseline refreshes to the live rate ` +
            `${fmt(currentRate)} OGN/sec`
        : `Still inside the step period (opened at ${checkpointTime.toString()}, ` +
            `${stepPeriod}s long, ends ${periodEnd.toString()}); baseline stays ` +
            `at ${fmt(checkpointRate)} OGN/sec`
    );

    const stepped = clampStep(rate, baseline, maxStepBps);
    if (!stepped.eq(rate)) {
      log.warn(
        `Step limit (${maxStepBps} bps of ${fmt(
          baseline
        )} OGN/sec) moved the ` +
          `rate from ${fmt(rate)} to ${fmt(stepped)}. It will take several ` +
          `runs to converge.`
      );
      rate = stepped;
    }

    // --- Deadband
    const delta = rate.gt(currentRate)
      ? rate.sub(currentRate)
      : currentRate.sub(rate);
    if (
      currentRate.gt(0) &&
      delta.mul(10000).lt(currentRate.mul(deadbandBps))
    ) {
      log.info(
        `Change of ${fmt(delta)} OGN/sec is inside the ${deadbandBps} bps ` +
          `deadband; leaving the rate alone`
      );
      return;
    }

    log.info(`Proposed rate: ${fmt(rate)} OGN/sec`);
    log.info(
      `Implied runway: ${
        rate.isZero() ? "infinite" : available.div(rate).toNumber() / 86400
      } days`
    );

    if (dryrun) {
      log.info("Dry run, not broadcasting");
      return;
    }

    const tx = await module.connect(signer).setRewardRate(rate);
    await logTxDetails(tx, "setRewardRate on SetXOGNRewardRateModule");
  },
});

/**
 * Sums OGN delivered to the reward source by CoW over the trailing window.
 *
 * Filtering on the settlement contract as sender is what keeps manual top-ups
 * and donations out of the measurement — they are meant to sit as reserve
 * rather than raise the rate. It also excludes OGN arriving from xOGN itself
 * via `ognClaimAndForwardRewards`.
 *
 * Scans forward from the last scanned block and keeps the individual fills, so
 * a routine run reads a few days of blocks instead of the whole window.
 */
async function measureInflow({
  provider,
  latestBlock,
  windowBlocks,
  config,
  chainId,
  log,
}: {
  provider: ethers.providers.Provider;
  latestBlock: number;
  windowBlocks: number;
  config: ReturnType<typeof loadConfig>;
  chainId: number;
  log: { info: (m: string) => void; warn: (m: string) => void };
}): Promise<BigNumber> {
  const { blockBatchSize, reorgBufferBlocks } = config.script;
  const store = keyValueStoreLocalClient({ _storePath: STORE_PATH });

  const windowStart = Math.max(latestBlock - windowBlocks, 0);
  const storedKey = `fills-${chainId}`;
  const cursorKey = `lastScannedBlock-${chainId}`;

  const storedFills: Fill[] = (await store.get(storedKey)) || [];
  const lastScanned: number | undefined = await store.get(cursorKey);

  // A cold or lost store must trigger a full backfill, never a short scan. A
  // partial window under-reports buying, which sets the rate too low and
  // quietly starves stakers.
  let fromBlock: number;
  if (lastScanned === undefined || storedFills.length === 0) {
    fromBlock = windowStart;
    log.warn(
      `No usable scan state; backfilling the full ${windowBlocks}-block window ` +
        `from ${fromBlock}`
    );
  } else {
    // Re-scan a little of what we already have so a reorg cannot strand or
    // duplicate a fill. Duplicates are removed by id below.
    fromBlock = Math.max(lastScanned - reorgBufferBlocks, windowStart);
  }

  const fresh: Fill[] = [];
  for (let start = fromBlock; start <= latestBlock; ) {
    const end = Math.min(start + blockBatchSize - 1, latestBlock);
    const logs = await provider.getLogs({
      address: addresses.mainnet.OGN,
      fromBlock: start,
      toBlock: end,
      topics: [
        TRANSFER_TOPIC,
        ethers.utils.hexZeroPad(COW_SETTLEMENT, 32),
        ethers.utils.hexZeroPad(addresses.mainnet.OGNRewardsSource, 32),
      ],
    });
    for (const entry of logs) {
      fresh.push({
        block: entry.blockNumber,
        id: `${entry.transactionHash}:${entry.logIndex}`,
        amount: BigNumber.from(entry.data).toString(),
      });
    }
    start = end + 1;
  }

  // Merge, drop anything that aged out, and de-duplicate the re-scanned overlap.
  const byId = new Map<string, Fill>();
  for (const fill of [...storedFills, ...fresh]) {
    if (fill.block >= windowStart) byId.set(fill.id, fill);
  }
  const fills = [...byId.values()].sort((a, b) => a.block - b.block);

  await store.put(storedKey, fills);
  await store.put(cursorKey, latestBlock);

  log.info(
    `Scanned blocks ${fromBlock}-${latestBlock} (${fresh.length} new fills, ` +
      `${fills.length} in window)`
  );

  return fills.reduce(
    (sum, fill) => sum.add(BigNumber.from(fill.amount)),
    BigNumber.from(0)
  );
}

function clamp(value: BigNumber, low: BigNumber, high: BigNumber): BigNumber {
  if (high.lt(low)) return low;
  if (value.lt(low)) return low;
  if (value.gt(high)) return high;
  return value;
}

/// Clamp to within `maxStepBps` of `baseline`. The baseline is the module's
/// step checkpoint, which is the live rate only once per step period.
function clampStep(
  value: BigNumber,
  baseline: BigNumber,
  maxStepBps: number
): BigNumber {
  if (baseline.isZero()) return value;
  const maxDelta = baseline.mul(maxStepBps).div(10000);
  if (value.gt(baseline.add(maxDelta))) return baseline.add(maxDelta);
  if (value.lt(baseline.sub(maxDelta))) return baseline.sub(maxDelta);
  return value;
}

function fmt(value: BigNumber): string {
  return ethers.utils.formatUnits(value, 18);
}
