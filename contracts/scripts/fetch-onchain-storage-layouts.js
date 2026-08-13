#!/usr/bin/env node

/**
 * Fetches the storage layout of every deployed implementation from the block
 * explorer's verified source, and caches it under build/storage-onchain/.
 *
 * This is ground truth: it is what is ACTUALLY deployed, independent of anything
 * recorded in the repo. Two uses:
 *   - seeding baselines for contracts that have a descriptor but no recorded layout;
 *   - auditing recorded layouts for drift (a deploy that never wrote its layout).
 *
 * It writes a cache rather than editing descriptors directly, because a full run
 * takes hours and the merge step should be cheap to repeat.
 *
 * Proxies are skipped: their own layout is unstructured EIP-1967 slots, and the
 * layout that matters for an upgrade is the implementation's.
 *
 * Resumable — an existing output file is left alone unless --force is given.
 *
 * Usage:
 *   node scripts/fetch-onchain-storage-layouts.js --network mainnet
 *   node scripts/fetch-onchain-storage-layouts.js --network base --concurrency 4
 *   node scripts/fetch-onchain-storage-layouts.js --network mainnet --only OUSDVault,OUSD
 */

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const CONTRACTS_ROOT = path.join(__dirname, "..");
const IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const NETWORKS = {
  mainnet: { chainId: 1, rpcEnv: "MAINNET_PROVIDER_URL" },
  base: { chainId: 8453, rpcEnv: "BASE_PROVIDER_URL" },
};

function parseArgs(argv) {
  const args = { network: null, concurrency: 4, only: null, force: false };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--network":
        args.network = argv[++i];
        break;
      case "--concurrency":
        args.concurrency = Number(argv[++i]);
        break;
      case "--only":
        args.only = argv[++i].split(",").map((s) => s.trim());
        break;
      case "--force":
        args.force = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  if (!NETWORKS[args.network]) {
    throw new Error(
      `--network must be one of: ${Object.keys(NETWORKS).join(", ")}`
    );
  }
  return args;
}

function loadEnv() {
  const envPath = path.join(CONTRACTS_ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function cast(args, timeoutMs = 300000) {
  return new Promise((resolve) => {
    execFile(
      "cast",
      args,
      { encoding: "utf8", maxBuffer: 128 * 1024 * 1024, timeout: timeoutMs },
      (err, stdout, stderr) =>
        resolve({
          ok: !err,
          stdout: stdout || "",
          stderr: stderr || String(err || ""),
        })
    );
  });
}

async function main() {
  const { network, concurrency, only, force } = parseArgs(process.argv);
  loadEnv();

  const { chainId, rpcEnv } = NETWORKS[network];
  const rpcUrl = process.env[rpcEnv];
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!rpcUrl) throw new Error(`${rpcEnv} not set`);
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY not set");

  const deployDir = path.join(CONTRACTS_ROOT, "deployments", network);
  const outDir = path.join(CONTRACTS_ROOT, "build", "storage-onchain", network);
  fs.mkdirSync(outDir, { recursive: true });

  let targets = fs
    .readdirSync(deployDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .filter((n) => !only || only.includes(n))
    .map((name) => {
      let address = null;
      try {
        address = JSON.parse(
          fs.readFileSync(path.join(deployDir, `${name}.json`), "utf8")
        ).address;
      } catch {
        /* ignore unreadable descriptor */
      }
      return { name, address };
    })
    .filter((t) => t.address);

  console.log(
    `[storage] ${network} (chain ${chainId}): ${targets.length} descriptors`
  );

  // Classify first — cheap RPC reads — so hours are not spent on proxies.
  const classified = [];
  for (const t of targets) {
    const outFile = path.join(outDir, `${t.name}.json`);
    if (!force && fs.existsSync(outFile)) {
      classified.push({ ...t, skip: "already cached" });
      continue;
    }
    const code = await cast(["code", t.address, "--rpc-url", rpcUrl], 60000);
    if (!code.ok || code.stdout.trim().length <= 2) {
      classified.push({ ...t, skip: "no code at address" });
      continue;
    }
    const slot = await cast(
      ["storage", t.address, IMPL_SLOT, "--rpc-url", rpcUrl],
      60000
    );
    const isProxy = slot.ok && /[1-9a-f]/.test(slot.stdout.trim().slice(2));
    classified.push(isProxy ? { ...t, skip: "proxy" } : t);
  }

  const work = classified.filter((t) => !t.skip);
  const skipped = classified.filter((t) => t.skip);
  const bySkip = skipped.reduce(
    (a, t) => ((a[t.skip] = (a[t.skip] || 0) + 1), a),
    {}
  );
  console.log(
    `[storage] to fetch: ${work.length}   skipped: ${JSON.stringify(bySkip)}`
  );
  if (!work.length) return;

  let done = 0;
  let failed = 0;
  const started = Date.now();

  async function worker() {
    for (;;) {
      const t = work.shift();
      if (!t) return;
      const res = await cast([
        "storage",
        t.address,
        "--rpc-url",
        rpcUrl,
        "--etherscan-api-key",
        apiKey,
        "--json",
      ]);
      done++;
      const elapsed = Math.round((Date.now() - started) / 1000);
      let layout = null;
      if (res.ok) {
        const i = res.stdout.indexOf("{");
        if (i >= 0) {
          try {
            layout = JSON.parse(res.stdout.slice(i));
          } catch {
            /* fall through to failure */
          }
        }
      }
      if (!layout || !Array.isArray(layout.storage)) {
        failed++;
        const why = (
          res.stderr.split("\n").find((l) => l.trim()) || "unknown"
        ).slice(0, 90);
        console.log(
          `[storage] ${done}/${done + work.length} FAIL ${
            t.name
          } — ${why} (${elapsed}s)`
        );
        continue;
      }
      fs.writeFileSync(
        path.join(outDir, `${t.name}.json`),
        JSON.stringify(
          {
            name: t.name,
            address: t.address,
            chainId,
            source: "cast storage (verified source)",
            rows: layout.storage.length,
            layout,
          },
          null,
          2
        )
      );
      console.log(
        `[storage] ${done}/${done + work.length} ok   ${t.name} (${
          layout.storage.length
        } rows, ${elapsed}s)`
      );
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker())
  );
  console.log(
    `[storage] done: ${done - failed} fetched, ${failed} failed, ${Math.round(
      (Date.now() - started) / 60000
    )} min`
  );
}

main().catch((e) => {
  console.error(`[storage] ${e.message}`);
  process.exit(1);
});
