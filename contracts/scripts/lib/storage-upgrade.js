"use strict";

/**
 * Storage-layout upgrade policy, extracted from scripts/check-storage-upgrade.js
 * so it can be tested without a Foundry toolchain, a build, or a subprocess.
 *
 * Everything here is pure: no fs, no child_process, no process.*. The CLI owns
 * argument handling, reading the descriptor, shelling out to `forge inspect`,
 * and — critically — the single `process.stdout.write("OK")` that Solidity's
 * `require(keccak256(vm.ffi(cmd)) == keccak256("OK"))` depends on.
 */

const { getStorageUpgradeErrors } = require("@openzeppelin/upgrades-core");

// Chains whose storage is gated. Mirrors DIR_BY_CHAIN in tasks/lib/contracts.ts,
// narrowed per CLAUDE.md — elsewhere there is no baseline to compare against.
const NETWORK_BY_CHAIN = { 1: "mainnet", 8453: "base" };

const GAP_LABEL = /^_+[a-z]*gap$/i;

function networkFor(chainId) {
  return NETWORK_BY_CHAIN[chainId];
}

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
 * before comparing. Returns a copy — stored layouts stay faithful to their source.
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
 * the `_deprecated_*` / `*_deprecated` convention.
 *
 * Deliberately conservative in two directions:
 *   - `oUSD` -> `oToken` is NOT auto-accepted. From a layout alone it is
 *     indistinguishable from two variables trading labels.
 *   - labels identical after normalisation (`_asset` -> `asset`) are NOT
 *     accepted either. Such a rename moves nothing, but two variables whose
 *     names differ only in punctuation could swap and both would qualify.
 *     Blocking costs an _allowStorageBreak; accepting risks a silent swap.
 */
function isDerivedRename(err) {
  if (!err || err.kind !== "rename") return false;
  const key = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const from = key(err.original && err.original.label);
  const to = key(err.updated && err.updated.label);
  if (!from || !to || from === to) return false;
  return to.includes(from) || from.includes(to);
}

/**
 * Decide whether `candidate` can safely replace what is recorded in `descriptor`.
 *
 * @param {object}      args
 * @param {string}      args.contract    contract name, for messages
 * @param {string}      args.network     network name, for messages
 * @param {object}      args.candidate   layout from the working tree
 * @param {object|null} args.descriptor  parsed descriptor, or null if absent
 * @param {string|null} [args.allowBreak] reason, if a break is deliberate
 * @returns {{ok: boolean, messages: string[], blocking: object[], failure: string|null}}
 */
function evaluate({ contract, network, candidate, descriptor, allowBreak }) {
  const messages = [];
  const pass = (msg) => {
    if (msg) messages.push(msg);
    return { ok: true, messages, blocking: [], failure: null };
  };

  if (!candidate || !Array.isArray(candidate.storage)) {
    return {
      ok: false,
      messages,
      blocking: [],
      failure: `forge inspect ${contract} produced no storage array`,
    };
  }

  if (candidate.storage.length === 0) {
    return pass(`${contract} declares no storage — nothing to check`);
  }

  if (!descriptor) {
    return pass(
      `${contract} has no descriptor on ${network} — treated as a new contract`
    );
  }

  const baseline = descriptor.storageLayout;
  if (!baseline || !Array.isArray(baseline.storage)) {
    return {
      ok: false,
      messages,
      blocking: [],
      failure:
        `${contract} is deployed on ${network} (${descriptor.address}) but its descriptor ` +
        `records no storageLayout, so there is nothing to compare against. Seed it ` +
        `first: node scripts/fetch-onchain-storage-layouts.js --network ${network} ` +
        `&& node scripts/seed-descriptor-storage-layouts.js --network ${network}`,
    };
  }

  // unsafeAllowCustomTypes: solc omits enum variant names from layouts, so OZ
  // cannot compare enums and would otherwise reject outright. An enum occupies
  // one byte regardless of variant count, so no slot moves; what is given up is
  // noticing that a stored value now decodes to a different variant.
  const errors = getStorageUpgradeErrors(
    normaliseGaps(baseline),
    normaliseGaps(candidate),
    { unsafeAllowCustomTypes: true }
  );

  const blocking = errors.filter((e) => !isDerivedRename(e));
  const renamed = errors.length - blocking.length;
  if (renamed > 0) {
    messages.push(
      `${contract}: ${renamed} deprecation rename(s) ignored (label-only)`
    );
  }

  if (blocking.length === 0) {
    return pass(
      `${contract}: storage layout compatible with ${network} (${descriptor.address})`
    );
  }

  messages.push(
    `${contract}: ${blocking.length} incompatible change(s) vs ${network}:`
  );
  for (const e of blocking) {
    const where = e.updated || e.original || {};
    messages.push(
      `  - ${e.kind}: ${where.label ?? "?"} (slot ${where.slot ?? "?"})`
    );
  }

  if (allowBreak) {
    return pass(`OVERRIDDEN by _allowStorageBreak: ${allowBreak}`);
  }

  return {
    ok: false,
    messages,
    blocking,
    failure:
      `${contract} storage layout is NOT upgrade-safe. If this is deliberate, ` +
      `record why with _allowStorageBreak(type(${contract}).name, "<reason>").`,
  };
}

module.exports = {
  NETWORK_BY_CHAIN,
  GAP_LABEL,
  networkFor,
  parseArgs,
  normaliseGaps,
  isDerivedRename,
  evaluate,
};
