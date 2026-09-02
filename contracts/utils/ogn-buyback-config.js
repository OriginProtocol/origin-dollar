const { readFileSync } = require("fs");
const { join } = require("path");

/**
 * OGN buyback configuration.
 *
 * The values live in `scripts/config/ogn-buyback.json` rather than here because the
 * Foundry deploy script (`scripts/deploy/mainnet/005_OGNBuyback.s.sol`) reads the same
 * file with `vm.readFile` + `vm.parseJson`. One file, both toolchains, no drift. JSON
 * cannot carry comments, so the documentation and validation live here.
 *
 * `scripts/` is already covered by `fs_permissions` in foundry.toml, which is why the
 * JSON sits there instead of next to this file.
 *
 * Only *decisions* belong in the JSON. Fixed addresses (reward source, xOGN, OGN, the
 * CoW harvester, the Guardian, the Talos relayer) stay in `utils/addresses.js`.
 *
 * Fields:
 *
 * split.operationsBps      – Share of each fee asset sent to the operations wallet, in
 *                            basis points. 2000 = 20% to operations, 80% to the buyback.
 *                            Capped at 5000 by FeeSplitter.MAX_OPERATIONS_BPS. Changing
 *                            it on a deployed splitter is governor-only.
 *                            NOTE: before this change 100% of fees funded OGN buybacks.
 *                            A non-zero value here diverts that share away from xOGN
 *                            stakers and lowers the computed reward rate proportionally.
 * split.operationsWallet   – Recipient of the operations share.
 *                            TODO: repoint to the NAV wallet. The Guardian Safe is a
 *                            placeholder. `setOperationsWallet` is governor-only, so
 *                            this change needs a governance vote.
 *
 * assets                   – Keyed by token symbol rather than a list of objects. Foundry
 *                            decodes a JSON array of structs positionally, and a `string`
 *                            member makes the encoding dynamic, which silently misaligns
 *                            the other fields. Keying by symbol lets the deploy script
 *                            enumerate with `vm.parseJsonKeys` and read each field by
 *                            path, which has no such failure mode.
 * assets[].address         – Fee asset the splitter distributes.
 * assets[].minDistribute   – Dust floor. Balances below this are skipped. Matched to the
 *                            CoW harvester's per-token `minSellAmount` so the splitter
 *                            never forwards an amount the harvester cannot sell.
 * assets[].rebasing        – True for OTokens. The splitter calls `rebaseOptIn()` on
 *                            these at deploy time so fees keep earning yield while they
 *                            wait to be distributed.
 *
 * moduleBounds.*           – Enforced on chain by SetXOGNRewardRateModule. These bound
 *                            the automated Talos key, not the Guardian, which can set
 *                            any rate directly. Set via `setBounds()` (Safe only).
 * moduleBounds.minRunwaySeconds
 *                          – Hard floor, an emergency brake. Deliberately far below the
 *                            script's operating range: a brake that equals the target
 *                            never catches anything the script would not have clamped.
 * moduleBounds.maxStepBps  – Largest move per step period, measured against the module's
 *                            checkpoint rather than the live rate.
 * moduleBounds.stepPeriodSeconds
 *                          – How long a step checkpoint holds before it refreshes. 7 days,
 *                            matching the weekly schedule, so a normal run always opens a
 *                            fresh period and behaves as if the limit were per call. The
 *                            period is what makes maxStepBps bound anything at all: per
 *                            call, each update becomes the next one's baseline and a key
 *                            can walk minRate -> maxRate in a few back-to-back txs. It
 *                            also leaves a failed run free to retry within the period.
 *
 * script.windowDays        – Trailing window for measuring OGN bought via CoW. 30 days;
 *                            shorter windows are noisy (14d reads 1.262 OGN/s against
 *                            30d's 1.689 on the same data).
 * script.minRunwaySeconds  – Script's operating floor; drives `ceilRate` ("don't drain").
 * script.maxRunwaySeconds  – Script's operating ceiling; drives `floorRate` ("don't
 *                            hoard"). Near-inert while the reward source holds ~1.6 days;
 *                            becomes meaningful if it is ever funded to a real reserve.
 * script.deadbandBps       – Skip the update when the change is smaller than this.
 * script.blockBatchSize    – Blocks per `eth_getLogs` call during a cold-start backfill.
 *                            10000 is also the cap some providers enforce.
 * script.reorgBufferBlocks – Blocks re-scanned each run so a reorg cannot lose or
 *                            double-count a fill.
 */

const CONFIG_PATH = join(
  __dirname,
  "..",
  "scripts",
  "config",
  "ogn-buyback.json"
);

const MAX_OPERATIONS_BPS = 5000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isAddress(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isUintString(value) {
  return typeof value === "string" && /^[0-9]+$/.test(value);
}

/**
 * Fail loudly on a bad config before any of it becomes a transaction.
 */
function validate(config) {
  const errors = [];

  const { split, assets, moduleBounds, script } = config;

  if (!Number.isInteger(split?.operationsBps)) {
    errors.push("split.operationsBps must be an integer");
  } else if (
    split.operationsBps < 0 ||
    split.operationsBps > MAX_OPERATIONS_BPS
  ) {
    errors.push(
      `split.operationsBps must be between 0 and ${MAX_OPERATIONS_BPS}, got ${split.operationsBps}`
    );
  }

  if (!isAddress(split?.operationsWallet)) {
    errors.push("split.operationsWallet must be an address");
  } else if (split.operationsWallet === ZERO_ADDRESS) {
    errors.push("split.operationsWallet must not be the zero address");
  }

  const assetNames =
    assets && typeof assets === "object" ? Object.keys(assets) : [];
  if (assetNames.length === 0) {
    errors.push("assets must be a non-empty object keyed by token symbol");
  } else {
    const seen = new Set();
    for (const label of assetNames) {
      const asset = assets[label];
      if (!isAddress(asset?.address)) {
        errors.push(`assets.${label}.address must be an address`);
        continue;
      }
      const key = asset.address.toLowerCase();
      if (seen.has(key))
        errors.push(`assets.${label} duplicates another asset's address`);
      seen.add(key);
      if (!isUintString(asset?.minDistribute)) {
        errors.push(`assets.${label}.minDistribute must be a decimal string`);
      }
      if (typeof asset?.rebasing !== "boolean") {
        errors.push(`assets.${label}.rebasing must be a boolean`);
      }
    }
  }

  for (const key of ["minRate", "maxRate"]) {
    if (!isUintString(moduleBounds?.[key])) {
      errors.push(`moduleBounds.${key} must be a decimal string`);
    }
  }
  if (
    isUintString(moduleBounds?.minRate) &&
    isUintString(moduleBounds?.maxRate) &&
    BigInt(moduleBounds.minRate) > BigInt(moduleBounds.maxRate)
  ) {
    errors.push("moduleBounds.minRate must not exceed moduleBounds.maxRate");
  }
  if (
    !Number.isInteger(moduleBounds?.maxStepBps) ||
    moduleBounds.maxStepBps <= 0 ||
    moduleBounds.maxStepBps > 10000
  ) {
    errors.push("moduleBounds.maxStepBps must be an integer in (0, 10000]");
  }
  if (
    !Number.isInteger(moduleBounds?.stepPeriodSeconds) ||
    moduleBounds.stepPeriodSeconds <= 0 ||
    moduleBounds.stepPeriodSeconds > 0xffffffff
  ) {
    errors.push(
      "moduleBounds.stepPeriodSeconds must be a positive integer that fits uint32"
    );
  }
  if (
    !Number.isInteger(moduleBounds?.minRunwaySeconds) ||
    moduleBounds.minRunwaySeconds <= 0
  ) {
    errors.push("moduleBounds.minRunwaySeconds must be a positive integer");
  }

  if (!Number.isInteger(script?.windowDays) || script.windowDays <= 0) {
    errors.push("script.windowDays must be a positive integer");
  }
  for (const key of [
    "minRunwaySeconds",
    "maxRunwaySeconds",
    "blockBatchSize",
    "reorgBufferBlocks",
  ]) {
    if (!Number.isInteger(script?.[key]) || script[key] <= 0) {
      errors.push(`script.${key} must be a positive integer`);
    }
  }
  if (
    Number.isInteger(script?.minRunwaySeconds) &&
    Number.isInteger(script?.maxRunwaySeconds) &&
    script.minRunwaySeconds > script.maxRunwaySeconds
  ) {
    errors.push(
      "script.minRunwaySeconds must not exceed script.maxRunwaySeconds"
    );
  }
  if (
    !Number.isInteger(script?.deadbandBps) ||
    script.deadbandBps < 0 ||
    script.deadbandBps > 10000
  ) {
    errors.push("script.deadbandBps must be an integer in [0, 10000]");
  }

  // The on-chain brake must sit below the script's operating floor. If they are equal
  // the brake only ever fires on rates the script would already have clamped, which
  // means it is not independently protecting anything.
  if (
    Number.isInteger(moduleBounds?.minRunwaySeconds) &&
    Number.isInteger(script?.minRunwaySeconds) &&
    moduleBounds.minRunwaySeconds >= script.minRunwaySeconds
  ) {
    errors.push(
      `moduleBounds.minRunwaySeconds (${moduleBounds?.minRunwaySeconds}) must be below ` +
        `script.minRunwaySeconds (${script?.minRunwaySeconds}) so the on-chain floor is a ` +
        `backstop rather than a duplicate of the script's target`
    );
  }

  if (errors.length) {
    throw new Error(
      `Invalid ogn-buyback config:\n  - ${errors.join("\n  - ")}`
    );
  }

  return config;
}

function loadConfig(path = CONFIG_PATH) {
  return validate(JSON.parse(readFileSync(path, "utf8")));
}

module.exports = {
  CONFIG_PATH,
  MAX_OPERATIONS_BPS,
  loadConfig,
  validate,
};
