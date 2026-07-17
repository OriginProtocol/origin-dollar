// Differential test: viem port of the beacon proof engine vs the ethers original.
//
// Goal: prove that tasks/actions-viem/_lib/proofs.viem.ts produces byte-identical
// output to utils/proofs.js for every one of the 7 proof functions.
//
// Both implementations are driven with IDENTICAL inputs (the same blockView /
// blockTree / stateView, and the same validatorIndex / depositIndex). The state
// is built OFFLINE from a cached Electra BeaconState SSZ file (no RPC), mirroring
// utils/beacon.js getBeaconBlock minus the RPC block fetch.
//
// Run with: npx tsx scripts/talos/beacon-proof-diff.mjs
//
// tsx is required (not plain node) because it can import the TypeScript viem port.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, "..", "..");
const STATE_SSZ_PATH = path.join(
  CONTRACTS_DIR,
  "cache",
  "state_14465000.ssz"
);

// ---------------------------------------------------------------------------
// 1. Build blockView / blockTree / stateView ONCE, offline, from the cache.
// ---------------------------------------------------------------------------
async function buildViews() {
  const { ssz } = await import("@lodestar/types");
  // The cached state SSZ files (slots 14465000 / 14471000) are post-Fulu-fork
  // BeaconState. They only deserialize cleanly as ssz.fulu.BeaconState (an
  // Electra decode fails with an offset mismatch). This is irrelevant to the
  // differential test: both impls receive the same fulu view, and the proof
  // functions read `stateView.type.getPathInfo(...)` dynamically, so they work
  // for any fork's view.
  const BeaconState = ssz.fulu.BeaconState;
  const BeaconBlock = ssz.fulu.BeaconBlock;

  console.log(`Reading cached beacon state: ${STATE_SSZ_PATH}`);
  const stateSsz = fs.readFileSync(STATE_SSZ_PATH);
  console.log(`Deserializing ${stateSsz.length} bytes of BeaconState SSZ...`);
  const stateView = BeaconState.deserializeToView(stateSsz);

  // Synthetic block; for a differential test the two impls both receive the
  // same views, which is all that matters. Use defaultView() (a TreeView with a
  // `.tree` accessor) rather than defaultViewDU() so we mirror the original
  // getBeaconBlock, which does `blockView.tree.clone()` on a BeaconBlock.toView.
  const blockView = BeaconBlock.defaultView();
  const blockTree = blockView.tree.clone();
  blockTree.setNode(
    blockView.type.getPropertyGindex("stateRoot"),
    stateView.node
  );

  return { blockView, blockTree, stateView };
}

// ---------------------------------------------------------------------------
// 2. Deep-equality helpers that normalize the value types the proofs return.
//    Fields can be: hex strings, bigint gindices, numbers, ethers BigNumber
//    (MAX_UINT64 / withdrawableEpoch), Infinity, and Lodestar view objects
//    (pendingDeposit). We compare by a stable canonical serialization.
// ---------------------------------------------------------------------------
function canonical(value) {
  if (value === null || value === undefined) {
    return `${value}`;
  }
  const t = typeof value;
  if (t === "bigint") {
    return `bigint:${value.toString()}`;
  }
  if (t === "number") {
    return `number:${value}`;
  }
  if (t === "string") {
    return `string:${value}`;
  }
  if (t === "boolean") {
    return `boolean:${value}`;
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return `bytes:${Buffer.from(value).toString("hex")}`;
  }
  // ethers BigNumber (used for MAX_UINT64 / withdrawableEpoch)
  if (t === "object" && typeof value._isBigNumber === "boolean" && value._hex) {
    return `bignumber:${BigInt(value.toString()).toString()}`;
  }
  // ethers BigNumber via toString / _hex fallback
  if (t === "object" && typeof value.toHexString === "function") {
    return `bignumber:${BigInt(value.toString()).toString()}`;
  }
  // Lodestar view objects (e.g. pendingDeposit): compare by their tree root and
  // the readable scalar fields we care about.
  if (t === "object") {
    const parts = [];
    if (value.node && value.node.root) {
      parts.push(`root:${Buffer.from(value.node.root).toString("hex")}`);
    }
    for (const key of Object.keys(value).sort()) {
      try {
        parts.push(`${key}=${canonical(value[key])}`);
      } catch {
        // skip non-serializable accessor
      }
    }
    return `object:{${parts.join(",")}}`;
  }
  return `unknown:${String(value)}`;
}

function compareResults(a, b) {
  // Union of keys so an extra/missing field is caught.
  const keys = Array.from(
    new Set([...Object.keys(a), ...Object.keys(b)])
  ).sort();
  const fieldResults = [];
  let allMatch = true;
  for (const key of keys) {
    const ca = canonical(a[key]);
    const cb = canonical(b[key]);
    const match = ca === cb;
    if (!match) {
      allMatch = false;
    }
    fieldResults.push({ key, match, a: ca, b: cb });
  }
  return { allMatch, fieldResults };
}

// ---------------------------------------------------------------------------
// 3. Run each of the 7 proof functions with both implementations.
// ---------------------------------------------------------------------------
async function main() {
  const views = await buildViews();
  const { blockView, blockTree, stateView } = views;

  const validatorsLen = stateView.validators.length;
  const pendingDepositsLen = stateView.pendingDeposits.length;
  console.log(`validators.length      = ${validatorsLen}`);
  console.log(`pendingDeposits.length = ${pendingDepositsLen}`);

  // Pick a present validator index (0 and a mid-range index).
  const validatorIndex = validatorsLen > 1 ? Math.floor(validatorsLen / 2) : 0;
  // Deposit index 0 exercises the populated path when deposits exist; the
  // container-only / empty-path functions do not need a deposit index.
  const depositIndex = 0;
  console.log(`Using validatorIndex   = ${validatorIndex}`);
  console.log(
    `pendingDeposits present= ${pendingDepositsLen > 0} (depositIndex ${depositIndex})`
  );

  // Import both implementations.
  const original = require(path.join(CONTRACTS_DIR, "utils", "proofs.js"));
  const viem = await import(
    path.join(CONTRACTS_DIR, "tasks", "actions-viem", "_lib", "proofs.viem.ts")
  );

  // Function specs: name -> args object shared by both impls.
  const base = { blockView, blockTree, stateView };
  const specs = [
    {
      fn: "generateFirstPendingDepositSlotProof",
      args: { ...base },
      // exercised for both empty and populated states via isEmpty field
    },
    {
      fn: "generateValidatorWithdrawableEpochProof",
      args: { ...base, validatorIndex },
    },
    {
      fn: "generateValidatorPubKeyProof",
      args: { ...base, validatorIndex },
    },
    {
      fn: "generatePendingDepositsContainerProof",
      args: { ...base },
    },
    {
      fn: "generateBalancesContainerProof",
      args: { ...base },
    },
    {
      fn: "generateBalanceProof",
      args: { ...base, validatorIndex },
    },
  ];

  // Only run generatePendingDepositProof when there is at least one deposit,
  // since it unconditionally reads pendingDeposits.get(depositIndex).
  if (pendingDepositsLen > 0) {
    specs.push({
      fn: "generatePendingDepositProof",
      args: { ...base, depositIndex },
    });
  } else {
    console.log(
      "NOTE: pendingDeposits is empty; generatePendingDepositProof is skipped " +
        "(both impls would throw identically on .get(0))."
    );
  }

  const perFunction = [];
  let allMatch = true;

  for (const spec of specs) {
    const { fn, args } = spec;
    let origRes;
    let viemRes;
    let origErr = null;
    let viemErr = null;

    try {
      origRes = await original[fn](args);
    } catch (e) {
      origErr = e;
    }
    try {
      viemRes = await viem[fn](args);
    } catch (e) {
      viemErr = e;
    }

    // If both threw, that is a matching outcome (identical control flow).
    if (origErr || viemErr) {
      const bothThrew = !!origErr && !!viemErr;
      const sameMsg =
        bothThrew && String(origErr.message) === String(viemErr.message);
      const match = bothThrew && sameMsg;
      if (!match) allMatch = false;
      perFunction.push({
        fn,
        match,
        fields: "throw",
        mismatchDetail: match
          ? `both threw identically: ${origErr.message}`
          : `orig ${origErr ? "threw: " + origErr.message : "returned"} / ` +
            `viem ${viemErr ? "threw: " + viemErr.message : "returned"}`,
      });
      console.log(
        `${match ? "PASS" : "FAIL"} ${fn} (throw path)` +
          (match ? "" : ` -- ${perFunction[perFunction.length - 1].mismatchDetail}`)
      );
      continue;
    }

    const { allMatch: fnMatch, fieldResults } = compareResults(
      origRes,
      viemRes
    );
    if (!fnMatch) allMatch = false;

    const fields = fieldResults.map((f) => f.key).join(", ");
    const mismatches = fieldResults
      .filter((f) => !f.match)
      .map((f) => `${f.key}: orig=${f.a} viem=${f.b}`);

    perFunction.push({
      fn,
      match: fnMatch,
      fields,
      mismatchDetail: mismatches.length ? mismatches.join(" | ") : "",
    });

    console.log(`${fnMatch ? "PASS" : "FAIL"} ${fn}`);
    console.log(`     fields: ${fields}`);
    if (mismatches.length) {
      for (const m of mismatches) {
        console.log(`     MISMATCH ${m}`);
      }
    }
  }

  // ---- Summary ----
  console.log("\n==================== SUMMARY ====================");
  for (const r of perFunction) {
    console.log(`  ${r.match ? "PASS" : "FAIL"}  ${r.fn}`);
  }
  console.log("================================================");
  console.log(allMatch ? "ALL MATCH: byte-identical" : "MISMATCH DETECTED");

  // Emit a machine-readable blob for the caller.
  console.log(
    "RESULT_JSON=" +
      JSON.stringify({
        allMatch,
        perFunction,
        harnessPath: path.join(
          CONTRACTS_DIR,
          "scripts",
          "talos",
          "beacon-proof-diff.mjs"
        ),
      })
  );

  process.exit(allMatch ? 0 : 1);
}

main().catch((e) => {
  console.error("HARNESS ERROR:", e);
  process.exit(2);
});
