#!/usr/bin/env node

/**
 * Storage-layout upgrade gate for a single contract that is about to be deployed.
 *
 * Baseline is the `storageLayout` recorded in deployments/<network>/<Name>.json —
 * i.e. what is deployed right now. Candidate is the working tree's version, via
 * `forge inspect`. The policy lives in scripts/lib/storage-upgrade.js; this file
 * is the I/O shell around it.
 *
 * Designed to be called over `vm.ffi` from AbstractDeployScript, so:
 *   - stdout is EXACTLY "OK" on success and nothing otherwise. There is exactly
 *     ONE write site below; keep it that way. Solidity does
 *     `require(keccak256(vm.ffi(cmd)) == keccak256("OK"))`, so any stray byte on
 *     stdout — including a library's advisory note — breaks every deploy.
 *   - all human-readable output goes to stderr;
 *   - a non-zero exit aborts the whole forge script before anything broadcasts.
 *
 * Usage:
 *   node scripts/check-storage-upgrade.js --contract OUSDVault --chain-id 1
 *   node scripts/check-storage-upgrade.js --contract OUSDVault --chain-id 1 \
 *        --allow-break "slots 51/64/72 retired; data abandoned deliberately"
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { networkFor, parseArgs, evaluate } = require("./lib/storage-upgrade");

const CONTRACTS_ROOT = path.join(__dirname, "..");

const say = (msg) => process.stderr.write(`[storage] ${msg}\n`);

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
  return JSON.parse(out.slice(i));
}

function readDescriptor(network, contract) {
  const p = path.join(
    CONTRACTS_ROOT,
    "deployments",
    network,
    `${contract}.json`
  );
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

function main() {
  const { contract, chainId, allowBreak } = parseArgs(process.argv);

  const network = networkFor(chainId);
  if (!network) {
    // Storage is gated on mainnet and Base only; elsewhere there is no baseline
    // to compare against and the check is a no-op rather than a failure.
    say(`chain ${chainId} is not storage-gated — skipping ${contract}`);
    return true;
  }

  const result = evaluate({
    contract,
    network,
    candidate: candidateLayout(contract),
    descriptor: readDescriptor(network, contract),
    allowBreak,
  });

  for (const message of result.messages) say(message);
  if (!result.ok) throw new Error(result.failure);
  return true;
}

try {
  if (main()) process.stdout.write("OK");
} catch (e) {
  say(e.message);
  process.exit(1);
}
