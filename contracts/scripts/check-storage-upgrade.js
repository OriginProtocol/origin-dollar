#!/usr/bin/env node

/**
 * Storage-layout upgrade gate for a single contract that is about to be deployed.
 *
 * Baseline is the `storageLayout` recorded in deployments/<network>/<Name>.json —
 * i.e. what is deployed right now. Candidate is the working tree's version, via
 * `forge inspect`. Comparison is @openzeppelin/upgrades-core, which supplies the
 * `__gap` shrink arithmetic and the type comparison; this script supplies only
 * policy.
 *
 * Designed to be called over `vm.ffi` from AbstractDeployScript, so:
 *   - stdout is EXACTLY "OK" on success and nothing otherwise;
 *   - all human-readable output goes to stderr;
 *   - a non-zero exit aborts the whole forge script before anything broadcasts.
 *
 * Policy:
 *   - candidate declares no storage        -> pass (proxies, libraries, views)
 *   - no descriptor for this contract      -> pass, "treated as new"
 *   - descriptor exists but records no layout, and the candidate HAS storage
 *                                          -> FAIL; the baseline must be seeded
 *   - a rename whose new label is DERIVED from the old (`assets` ->
 *     `_deprecated_assets`) -> ignored; an unrelated rename is NOT, because two
 *     same-typed variables trading labels also reports as two renames
 *   - enum member data missing             -> ignored (see below)
 *   - anything else                        -> FAIL unless --allow-break is given
 *
 * Enums: solc does not emit enum variant names in a storage layout, so OZ cannot
 * tell whether a variant was reordered or removed and refuses to judge. We ignore
 * that. An enum occupies one byte regardless of variant count, so no slot ever
 * moves; what is given up is detecting that a stored value now decodes to a
 * different variant, which is a semantic change rather than a slot collision.
 *
 * Gap labels are normalised IN MEMORY (`______gap`, `_gap`, `_____ugap` -> `__gap`)
 * because OZ's isGap() matches only `__gap`/`__gap_*`, while contracts deployed
 * before the rename still carry the old label on chain. Stored layouts stay
 * faithful to their source.
 *
 * Usage:
 *   node scripts/check-storage-upgrade.js --contract OUSDVault --chain-id 1
 *   node scripts/check-storage-upgrade.js --contract OUSDVault --chain-id 1 \
 *        --allow-break "slots 51/64/72 retired; data abandoned deliberately"
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { getStorageUpgradeErrors } = require("@openzeppelin/upgrades-core");

const CONTRACTS_ROOT = path.join(__dirname, "..");

// Mirrors DIR_BY_CHAIN in tasks/lib/contracts.ts, limited to the chains whose
// storage is gated (see CLAUDE.md).
const NETWORK_BY_CHAIN = { 1: "mainnet", 8453: "base" };

const GAP_LABEL = /^_+[a-z]*gap$/i;

const say = (msg) => process.stderr.write(`[storage] ${msg}\n`);

function parseArgs(argv) {
  const args = { contract: null, chainId: null, allowBreak: null };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--contract":
        args.contract = argv[++i];
        break;
      case "--chain-id":
        args.chainId = Number(argv[++i]);
        break;
      case "--allow-break":
        args.allowBreak = argv[++i];
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  if (!args.contract) throw new Error("--contract <Name> is required");
  if (!args.chainId) throw new Error("--chain-id <id> is required");
  return args;
}

/**
 * OZ recognises a gap only when it is labelled `__gap`/`__gap_*`. Contracts
 * deployed before the rename carry `______gap` on chain, so normalise both sides
 * before comparing. Never written back to disk.
 */
function normaliseGaps(layout) {
  const copy = JSON.parse(JSON.stringify(layout));
  for (const row of copy.storage || []) {
    if (GAP_LABEL.test(row.label)) row.label = "__gap";
  }
  return copy;
}

/**
 * True for a rename where the new label is plainly derived from the old one —
 * the `_deprecated_*` / `*_deprecated` convention. Deliberately conservative:
 * `oUSD` -> `oToken` is a real rename and is NOT auto-accepted, because from a
 * layout alone it is indistinguishable from two variables trading labels.
 */
function isDerivedRename(err) {
  if (err.kind !== "rename") return false;
  const key = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const from = key(err.original && err.original.label);
  const to = key(err.updated && err.updated.label);
  if (!from || !to || from === to) return false;
  return to.includes(from) || from.includes(to);
}

function candidateLayout(contract) {
  let out;
  try {
    out = execFileSync(
      "forge",
      ["inspect", contract, "storageLayout", "--json"],
      {
        cwd: CONTRACTS_ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
  } catch (e) {
    throw new Error(
      `forge inspect ${contract} failed — ${
        String(e.stderr || e.message).split("\n")[0]
      }`
    );
  }
  const i = out.indexOf("{");
  if (i < 0) throw new Error(`forge inspect ${contract} produced no JSON`);
  const layout = JSON.parse(out.slice(i));
  if (!Array.isArray(layout.storage)) {
    throw new Error(`forge inspect ${contract} produced no storage array`);
  }
  return layout;
}

function main() {
  const { contract, chainId, allowBreak } = parseArgs(process.argv);

  const network = NETWORK_BY_CHAIN[chainId];
  if (!network) {
    // Storage is gated on mainnet and Base only; elsewhere there is no baseline
    // to compare against and the check is a no-op rather than a failure.
    say(`chain ${chainId} is not storage-gated — skipping ${contract}`);
    process.stdout.write("OK");
    return;
  }

  const candidate = candidateLayout(contract);
  if (candidate.storage.length === 0) {
    say(`${contract} declares no storage — nothing to check`);
    process.stdout.write("OK");
    return;
  }

  const descPath = path.join(
    CONTRACTS_ROOT,
    "deployments",
    network,
    `${contract}.json`
  );
  if (!fs.existsSync(descPath)) {
    say(
      `${contract} has no descriptor on ${network} — treated as a new contract`
    );
    process.stdout.write("OK");
    return;
  }

  const desc = JSON.parse(fs.readFileSync(descPath, "utf8"));
  const baseline = desc.storageLayout;
  if (!baseline || !Array.isArray(baseline.storage)) {
    throw new Error(
      `${contract} is deployed on ${network} (${desc.address}) but its descriptor ` +
        `records no storageLayout, so there is nothing to compare against. Seed it ` +
        `first: node scripts/fetch-onchain-storage-layouts.js --network ${network} ` +
        `&& node scripts/seed-descriptor-storage-layouts.js --network ${network}`
    );
  }

  // unsafeAllowCustomTypes: enum members are absent from solc layouts — see header.
  const errors = getStorageUpgradeErrors(
    normaliseGaps(baseline),
    normaliseGaps(candidate),
    { unsafeAllowCustomTypes: true }
  );

  // Renames move nothing, so the deprecation convention (`assets` ->
  // `_deprecated_assets`) is safe to wave through. But a blanket rename pass is
  // NOT safe: swapping the labels of two same-typed variables also reports as two
  // renames, and afterwards code reading `alice` reads what used to be `bob`.
  // So only accept a rename whose new label is derived from the old one.
  const blocking = errors.filter((e) => !isDerivedRename(e));
  const renamed = errors.length - blocking.length;
  if (renamed > 0) {
    say(`${contract}: ${renamed} deprecation rename(s) ignored (label-only)`);
  }

  if (blocking.length === 0) {
    say(
      `${contract}: storage layout compatible with ${network} (${desc.address})`
    );
    process.stdout.write("OK");
    return;
  }

  say(`${contract}: ${blocking.length} incompatible change(s) vs ${network}:`);
  for (const e of blocking) {
    const where = e.updated || e.original || {};
    say(`  - ${e.kind}: ${where.label ?? "?"} (slot ${where.slot ?? "?"})`);
  }

  if (allowBreak) {
    say(`OVERRIDDEN by _allowStorageBreak: ${allowBreak}`);
    process.stdout.write("OK");
    return;
  }

  throw new Error(
    `${contract} storage layout is NOT upgrade-safe. If this is deliberate, ` +
      `record why with _allowStorageBreak(type(${contract}).name, "<reason>").`
  );
}

try {
  main();
} catch (e) {
  say(e.message);
  process.exit(1);
}
