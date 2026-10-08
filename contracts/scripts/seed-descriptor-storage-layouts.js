#!/usr/bin/env node

/**
 * One-time seed: writes a `storageLayout` into every deployment descriptor, so
 * the descriptor becomes the single record of what is deployed —
 * `{address, abi, storageLayout}`.
 *
 * Sources, in priority order:
 *   1. build/storage-onchain/<network>/<Name>.json — the layout of the contract
 *      ACTUALLY deployed, read from its verified source
 *      (scripts/fetch-onchain-storage-layouts.js). Ground truth.
 *   2. storageLayout/<network>/<Name>.json — the legacy snapshot.
 *      Used only where the chain fetch could not run: contracts compiled with
 *      solc 0.5.x that the current toolchain cannot rebuild, and stateless
 *      contracts whose layout is empty anyway.
 *
 * Layouts are stored FAITHFULLY, exactly as their source produced them. Gap-label
 * normalisation (`______gap` -> `__gap`) happens in memory at comparison time, so
 * a bug in that logic never costs a re-fetch.
 *
 * Run AFTER fetch-onchain-storage-layouts.js and BEFORE deleting storageLayout/,
 * since 14 contracts have no chain layout and would otherwise lose their baseline.
 *
 * Usage:
 *   node scripts/seed-descriptor-storage-layouts.js --network mainnet [--dry-run]
 */

const fs = require("fs");
const path = require("path");

const CONTRACTS_ROOT = path.join(__dirname, "..");
const NETWORKS = ["mainnet", "base"];

function parseArgs(argv) {
  const args = { network: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--network":
        args.network = argv[++i];
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  if (!NETWORKS.includes(args.network)) {
    throw new Error(`--network must be one of: ${NETWORKS.join(", ")}`);
  }
  return args;
}

/** Keep only the two fields a layout comparison needs. */
function slim(layout) {
  return { storage: layout.storage, types: layout.types || {} };
}

function main() {
  const { network, dryRun } = parseArgs(process.argv);

  const deployDir = path.join(CONTRACTS_ROOT, "deployments", network);
  const chainDir = path.join(
    CONTRACTS_ROOT,
    "build",
    "storage-onchain",
    network
  );
  const snapDir = path.join(CONTRACTS_ROOT, "storageLayout", network);

  const stats = { chain: 0, snapshot: 0, none: 0, unchanged: 0 };
  const noSource = [];

  for (const file of fs
    .readdirSync(deployDir)
    .filter((f) => f.endsWith(".json"))) {
    const name = file.slice(0, -5);
    const descPath = path.join(deployDir, file);

    let desc;
    try {
      desc = JSON.parse(fs.readFileSync(descPath, "utf8"));
    } catch {
      continue;
    }
    if (!desc.address || !Array.isArray(desc.abi)) continue;

    let layout = null;
    let origin = null;

    const chainPath = path.join(chainDir, file);
    if (fs.existsSync(chainPath)) {
      const cached = JSON.parse(fs.readFileSync(chainPath, "utf8"));
      // Only trust the cache if it still describes the address we have recorded.
      if (
        cached.address &&
        cached.address.toLowerCase() === desc.address.toLowerCase() &&
        cached.layout &&
        Array.isArray(cached.layout.storage)
      ) {
        layout = slim(cached.layout);
        origin = "chain";
      }
    }

    if (!layout) {
      const snapPath = path.join(snapDir, file);
      if (fs.existsSync(snapPath)) {
        const snap = JSON.parse(fs.readFileSync(snapPath, "utf8"));
        if (Array.isArray(snap.storage)) {
          layout = slim(snap);
          origin = "snapshot";
        }
      }
    }

    // No layout source is legitimate for proxies (they declare no storage, and
    // the legacy gate excluded them) and for deprecated contracts whose source
    // has left the repo. Still normalise the file to the descriptor format, so
    // the whole tree matches what create-deployment-descriptors.js writes.
    if (!layout) {
      stats.none++;
      noSource.push(name);
    }

    const next = layout
      ? { address: desc.address, abi: desc.abi, storageLayout: layout }
      : { address: desc.address, abi: desc.abi };
    const body = JSON.stringify(next, null, 2);
    if (body === JSON.stringify(desc, null, 2)) {
      stats.unchanged++;
      continue;
    }
    if (!dryRun) fs.writeFileSync(descPath, body);
    if (origin) stats[origin]++;
  }

  console.log(
    `[seed] ${network}: ${dryRun ? "would write " : "wrote "}` +
      `${stats.chain} from chain, ${stats.snapshot} from snapshot, ` +
      `${stats.unchanged} already current, ${stats.none} with no layout source`
  );
  if (noSource.length) {
    console.log(`[seed] no layout source (left without a baseline):`);
    for (const n of noSource) console.log(`         ${n}`);
  }
}

try {
  main();
} catch (e) {
  console.error(`[seed] ${e.message}`);
  process.exit(1);
}
