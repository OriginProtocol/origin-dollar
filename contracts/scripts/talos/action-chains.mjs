#!/usr/bin/env node
/**
 * Regenerate the Talos action inventory:
 *   1. chains supported per action (from each entry point's `chains:` decl)
 *   2. utility/lib/abi -> union-of-chains matrix (transitive import graph)
 *
 * Output: markdown to stdout. Regenerate the committed doc with:
 *   node scripts/talos/action-chains.mjs > docs/talos-actions-inventory.md
 *
 * Static parse of `tasks/actions/*.ts`. The two actions whose `chains:` is a
 * computed expression (not an array literal) are resolved via CHAINS_OVERRIDE.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ACT_DIR = join(ROOT, "tasks", "actions");

// Chains for actions whose `chains:` is a computed expression, not a literal.
const CHAINS_OVERRIDE = {
  otokenAddWithdrawalQueueLiquidity: [1, 8453, 146, 98866], // Object.keys(VAULT_DEPLOYMENTS_BY_CHAIN_ID)
};
const ALL_CHAINS = [1, 8453, 146, 560048, 999, 17000, 42161, 98866];
const NAME = {
  1: "eth", 8453: "base", 146: "sonic", 560048: "hoodi",
  999: "hyper", 17000: "holesky", 42161: "arb", 98866: "plume",
};

const impRe = /(?:from\s+|require\(\s*)["']([^"']+)["']/g;

function readActionMeta(file) {
  const txt = readFileSync(file, "utf8");
  const name = (txt.match(/name:\s*["']([^"']+)["']/) || [])[1] || file;
  let chains;
  if (CHAINS_OVERRIDE[name]) chains = CHAINS_OVERRIDE[name];
  else {
    const m = txt.match(/chains:\s*\[([^\]]*)\]/);
    if (m) chains = m[1].split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    else chains = []; // no constraint => all chains
  }
  const imports = [...txt.matchAll(impRe)].map((m) => m[1]).filter((i) => i.startsWith("."));
  return { name, chains: chains.length ? chains : ALL_CHAINS, file, imports };
}

// Resolve a relative import (from `fromFile`) to a repo-relative key like "utils/txLogger".
function resolveRel(imp, fromFile) {
  const abs = normalize(join(dirname(fromFile), imp));
  return abs.replace(ROOT + "/", "");
}

// transitive local-import edges
const edges = new Map();
function scan(key) {
  if (edges.has(key)) return;
  edges.set(key, new Set());
  const cands = [key, key + ".ts", key + ".js", key + ".json", join(key, "index.ts"), join(key, "index.js")].map((p) => join(ROOT, p));
  const real = cands.find((p) => existsSync(p) && statSync(p).isFile());
  if (!real || real.endsWith(".json")) return;
  for (const m of readFileSync(real, "utf8").matchAll(impRe)) {
    if (!m[1].startsWith(".")) continue;
    const tgt = resolveRel(m[1], real);
    edges.get(key).add(tgt);
    scan(join(ROOT, key) === real ? tgt : tgt);
  }
}

function closure(starts) {
  const seen = new Set(), stack = [...starts];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    for (const e of edges.get(n) || []) stack.push(e);
  }
  return seen;
}

const actions = readdirSync(ACT_DIR).filter((f) => f.endsWith(".ts")).map((f) => readActionMeta(join(ACT_DIR, f)));

// A1: chains per action, grouped by chain-set
const byChainSet = new Map();
for (const a of actions) {
  const key = a.chains.slice().sort((x, y) => x - y).join(",");
  (byChainSet.get(key) || byChainSet.set(key, []).get(key)).push(a.name);
}

// A2: util -> union chains
const utilChains = new Map();
for (const a of actions) {
  const roots = a.imports.map((i) => resolveRel(i, a.file));
  roots.forEach(scan);
  for (const u of closure(roots)) {
    if (u.startsWith("utils/") || u.startsWith("tasks/lib") || u.startsWith("abi/")) {
      (utilChains.get(u) || utilChains.set(u, new Set()).get(u));
      a.chains.forEach((c) => utilChains.get(u).add(c));
    }
  }
}

const fmt = (set) => [...set].sort((a, b) => a - b).map((c) => NAME[c]).join(", ");

let out = "# Talos action inventory (generated)\n\n";
out += "> Regenerate: `node scripts/talos/action-chains.mjs > docs/talos-actions-inventory.md`\n\n";
out += "## A1. Chains supported per action\n\n| chains | actions |\n|---|---|\n";
for (const [key, names] of [...byChainSet.entries()].sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]))) {
  const label = key ? key.split(",").map((c) => NAME[c]).join(", ") : "all";
  out += `| ${label} | ${names.sort().join(", ")} |\n`;
}
out += "\n## A2. Utility / lib / abi -> union of importing actions' chains\n\n| module | # chains | chains |\n|---|---|---|\n";
for (const [u, set] of [...utilChains.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))) {
  out += `| \`${u}\` | ${set.size} | ${fmt(set)} |\n`;
}
process.stdout.write(out);
