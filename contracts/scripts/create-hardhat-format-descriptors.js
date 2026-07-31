#!/usr/bin/env node

/**
 * Rewrites the Hardhat-format deployment descriptors for the contracts that the
 * Foundry broadcast which just ran actually deployed.
 *
 * Named for the format rather than for Hardhat: once `hardhat.config.js` is
 * deleted these are simply the descriptors the ops runtime reads.
 * `tasks/lib/contracts.ts` resolves every Talos cron's contract from
 * `deployments/<network>/<Name>.json`, and the Hardhat task CLI reads the same
 * files through hardhat-deploy. Foundry writes only addresses, to
 * `build/deployments-<chainId>.json`, so without this step a Foundry redeploy
 * leaves those descriptors pointing at the previous contract.
 *
 * Source of truth is `broadcast/DeployManager.s.sol/<chainId>/run-latest.json`.
 * forge writes it only under `--broadcast`, so fork simulations and `forge test`
 * can never trigger a descriptor rewrite.
 *
 * IT IS NOT SELF-DATING. A `--broadcast` run that produces zero transactions
 * exits 0 and leaves the PREVIOUS run's file byte-identical on disk, so the mere
 * presence of a run file does not mean this run deployed anything. That matters
 * because `make deploy-local` broadcasts against `pnpm node:anvil`, which forks
 * mainnet and therefore reports chain id 1 — it writes a chain-1 run file full of
 * anvil addresses, and (being REAL_DEPLOYING) also marks the scripts complete in
 * build/deployments-1.json, which is exactly what makes the next
 * `make deploy-mainnet` a zero-transaction run. Replaying that file would write
 * anvil addresses into live mainnet descriptors.
 *
 * The Makefile therefore deletes broadcast/DeployManager.s.sol/<chainId>/ before
 * invoking forge, so a run file existing afterwards necessarily came from the run
 * that just happened. Invoking this script by hand outside that recipe forfeits
 * the guarantee — check what run-latest.json holds first.
 *
 * Per deployed contract it writes exactly `{address, abi}` and drops every other
 * key the Hardhat artifact used to carry (receipt, args, solcInputHash, metadata,
 * bytecode, deployedBytecode, devdoc, userdoc, gasEstimates, linkReferences).
 * Keeping them would pair a fresh address with bytecode and metadata from the
 * superseded Hardhat deploy, which is worse than their absence. Nothing reads
 * them: `tasks/lib/contracts.ts` destructures `{address, abi}` only.
 *
 * Usage:
 *   node scripts/create-hardhat-format-descriptors.js --chain-id 1
 *   node scripts/create-hardhat-format-descriptors.js --chain-id 1 --dry-run
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// Mirrors DIR_BY_CHAIN in tasks/lib/contracts.ts.
const NETWORK_BY_CHAIN = {
  1: "mainnet",
  146: "sonic",
  999: "hyperevm",
  8453: "base",
  17000: "holesky",
  42161: "arbitrumOne",
  98866: "plume",
  560048: "hoodi",
};

// forge records a top-level contract creation as CREATE, or CREATE2 when the
// script used `new X{salt: …}()`. Both carry contractName + contractAddress.
// A CreateX deploy is a CALL with contractName null — deliberately not handled,
// those are not expected to emit descriptors.
const CREATION_TYPES = new Set(["CREATE", "CREATE2"]);

const CONTRACTS_ROOT = path.join(__dirname, "..");

function parseArgs(argv) {
  const args = { chainId: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--chain-id":
        args.chainId = Number(argv[++i]);
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--help":
      case "-h":
        console.log(
          "Usage: create-hardhat-format-descriptors.js --chain-id <id> [--dry-run]"
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  if (!args.chainId || !Number.isInteger(args.chainId)) {
    throw new Error("--chain-id <id> is required");
  }
  return args;
}

/**
 * Indexes out/ as contractName -> [artifact paths]. forge lays it out as
 * out/<Source>.sol/<Contract>.json, so the name alone is enough to resolve an
 * artifact provided it is unique — which is asserted at read time.
 */
function indexArtifacts(outDir) {
  const index = new Map();
  if (!fs.existsSync(outDir)) {
    throw new Error(`No forge output at ${outDir} — run \`forge build\` first`);
  }
  for (const sourceDir of fs.readdirSync(outDir)) {
    const abs = path.join(outDir, sourceDir);
    if (!fs.statSync(abs).isDirectory()) continue;
    for (const file of fs.readdirSync(abs)) {
      if (!file.endsWith(".json")) continue;
      const name = file.slice(0, -".json".length);
      if (!index.has(name)) index.set(name, []);
      index.get(name).push(path.join(abs, file));
    }
  }
  return index;
}

function readAbi(index, contractName) {
  const matches = index.get(contractName);
  if (!matches || matches.length === 0) {
    throw new Error(
      `No forge artifact for "${contractName}" — is out/ stale? Run \`forge build\``
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous artifact for "${contractName}": ${matches.join(", ")}`
    );
  }
  const artifact = JSON.parse(fs.readFileSync(matches[0], "utf8"));
  if (!Array.isArray(artifact.abi)) {
    throw new Error(`Artifact ${matches[0]} has no abi array`);
  }
  return artifact.abi;
}

/** Receipt status is "0x1" in forge's output, but tolerate 1/true as well. */
function isSuccessStatus(status) {
  if (status === 1 || status === true) return true;
  if (typeof status !== "string") return false;
  return Number(status) === 1;
}

/**
 * forge writes `timestamp` in milliseconds, but has used seconds in the past.
 * Disambiguate by magnitude rather than trusting either.
 */
function formatBroadcastTime(timestamp) {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return "unknown time";
  return new Date(n < 1e12 ? n * 1000 : n).toISOString();
}

function main() {
  const { chainId, dryRun } = parseArgs(process.argv);

  const network = NETWORK_BY_CHAIN[chainId];
  if (!network) {
    throw new Error(`No deployments directory mapped for chain ${chainId}`);
  }

  const broadcastPath = path.join(
    CONTRACTS_ROOT,
    "broadcast",
    "DeployManager.s.sol",
    String(chainId),
    "run-latest.json"
  );

  // The Makefile clears this directory before running forge, so "no file" means
  // this run broadcast nothing — a normal, healthy outcome, not an error.
  if (!fs.existsSync(broadcastPath)) {
    console.log(
      `[descriptors] no broadcast at ${path.relative(
        CONTRACTS_ROOT,
        broadcastPath
      )} — nothing deployed, nothing to do`
    );
    return;
  }

  const run = JSON.parse(fs.readFileSync(broadcastPath, "utf8"));

  // Guards against applying one chain's broadcast to another's descriptors.
  if (run.chain !== undefined && Number(run.chain) !== chainId) {
    throw new Error(
      `Broadcast is for chain ${run.chain} but --chain-id says ${chainId}`
    );
  }

  const deployDir = path.join(CONTRACTS_ROOT, "deployments", network);
  if (!fs.existsSync(deployDir)) {
    throw new Error(`No deployments directory at ${deployDir}`);
  }

  const transactions = Array.isArray(run.transactions) ? run.transactions : [];
  const creations = transactions.filter(
    (t) =>
      CREATION_TYPES.has(t.transactionType) &&
      t.contractName &&
      t.contractAddress
  );
  const skipped = transactions.length - creations.length;

  console.log(
    `[descriptors] ${network} (chain ${chainId}) — broadcast at ` +
      `${formatBroadcastTime(run.timestamp)}` +
      `${run.commit ? `, commit ${run.commit}` : ""}`
  );

  if (creations.length === 0) {
    console.log("[descriptors] no contract creations in this broadcast");
    return;
  }

  // A transaction being listed does not mean it landed. forge only warns (and
  // still exits 0) when the provider errors while polling a pending tx, so
  // require a successful receipt before believing an address.
  const landed = new Set(
    (Array.isArray(run.receipts) ? run.receipts : [])
      .filter((r) => r && r.contractAddress && isSuccessStatus(r.status))
      .map((r) => r.contractAddress.toLowerCase())
  );
  const unlanded = creations.filter(
    (t) => !landed.has(t.contractAddress.toLowerCase())
  );
  if (unlanded.length > 0) {
    throw new Error(
      `No successful receipt for ${unlanded
        .map((t) => `${t.contractName} (${t.contractAddress})`)
        .join(", ")} — the broadcast lists the creation but it did not land. ` +
        `Confirm on chain, then re-run once the broadcast reflects reality.`
    );
  }

  const artifacts = indexArtifacts(path.join(CONTRACTS_ROOT, "out"));

  // Resolve everything before writing anything, so a missing artifact fails the
  // run without leaving descriptors half-updated.
  const planned = creations.map((tx) => ({
    name: tx.contractName,
    address: ethers.utils.getAddress(tx.contractAddress),
    abi: readAbi(artifacts, tx.contractName),
    file: path.join(deployDir, `${tx.contractName}.json`),
  }));

  const duplicates = planned
    .map((p) => p.name)
    .filter((n, i, all) => all.indexOf(n) !== i);
  if (duplicates.length > 0) {
    throw new Error(
      `Broadcast deployed the same contract name more than once, so one ` +
        `descriptor would silently win: ${[...new Set(duplicates)].join(", ")}`
    );
  }

  for (const { name, address, abi, file } of planned) {
    const existed = fs.existsSync(file);
    // Matches hardhat-deploy's on-disk shape: address first, 2-space indent,
    // no trailing newline.
    const body = JSON.stringify({ address, abi }, null, 2);
    if (!dryRun) fs.writeFileSync(file, body);
    console.log(
      `[descriptors] ${dryRun ? "would " : ""}${
        existed ? "update" : "create"
      } ` + `deployments/${network}/${name}.json -> ${address}`
    );
  }

  if (skipped > 0) {
    console.log(
      `[descriptors] skipped ${skipped} non-creation transaction(s) ` +
        `(calls, and CreateX deploys which do not emit descriptors)`
    );
  }
  console.log(
    `[descriptors] ${dryRun ? "would write" : "wrote"} ${
      planned.length
    } descriptor(s)`
  );
}

try {
  main();
} catch (err) {
  console.error(`[descriptors] ${err.message}`);
  process.exit(1);
}
