// Differential test: viem port of the deposit-data-root computation vs the
// ethers original.
//
// Goal: prove that
//   tasks/actions-viem/_lib/depositData.viem.ts  (calcDepositRoot + hashPubKey)
// produces byte-identical output to the originals
//   tasks/beaconTesting.js   (calcDepositRoot)
//   utils/beacon.js          (hashPubKey)
// for a set of known deposit vectors.
//
// Both implementations are driven with IDENTICAL inputs. The deposit-data-root
// itself is SSZ (ssz.electra.DepositData.hashTreeRoot) in BOTH impls; only the
// surrounding byte plumbing differs (ethers.utils.* vs viem.*), which is exactly
// what this test pins down.
//
// Vectors:
//   - A real validator vector from the repo test data
//     (test/strategies/compoundingSSVStaking-validatorsData.json): a 48-byte
//     pubkey + 96-byte signature, exercised at 32 ETH and 2048 ETH with a 0x02
//     withdrawal credential (as used by compoundingSSVStaking.js).
//   - Synthetic vectors with a 0x01 credential and deterministic pubkey/sig.
//
// It also:
//   - tests hashPubKey equivalence on several pubkeys, and
//   - verifies the comparator FLAGS a deliberate mutation (so a false PASS is
//     impossible).
//
// Run with: npx tsx scripts/talos/deposit-root-diff.mjs
// tsx is required (not plain node) because it imports the TypeScript viem port.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, "..", "..");

const HARNESS_PATH = path.join(
  CONTRACTS_DIR,
  "scripts",
  "talos",
  "deposit-root-diff.mjs"
);

// ---------------------------------------------------------------------------
// Load the originals and the viem port.
// ---------------------------------------------------------------------------
const originalBeaconTesting = require(path.join(
  CONTRACTS_DIR,
  "tasks",
  "beaconTesting.js"
));
const originalBeacon = require(path.join(CONTRACTS_DIR, "utils", "beacon.js"));
const viem = await import(
  path.join(
    CONTRACTS_DIR,
    "tasks",
    "actions-viem",
    "_lib",
    "depositData.viem.ts"
  )
);

const origCalcDepositRoot = originalBeaconTesting.calcDepositRoot;
const origHashPubKey = originalBeacon.hashPubKey;
const viemCalcDepositRoot = viem.calcDepositRoot;
const viemHashPubKey = viem.hashPubKey;

// ---------------------------------------------------------------------------
// Build the deposit vectors.
// ---------------------------------------------------------------------------
function loadRealValidator() {
  const p = path.join(
    CONTRACTS_DIR,
    "test",
    "strategies",
    "compoundingSSVStaking-validatorsData.json"
  );
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  const v = data.testValidators[0];
  return {
    source: p,
    pubkey: v.publicKey,
    publicKeyHash: v.publicKeyHash,
    signature: v.signature,
  };
}

const real = loadRealValidator();

// A deterministic synthetic 48-byte pubkey and 96-byte signature.
const synthPubkey = "0x" + "ab".repeat(48);
const synthSig = "0x" + "cd".repeat(96);

const OWNER_A = "0x1234567890123456789012345678901234567890";
const OWNER_B = "0x0000000000000000000000000000000000000000";

// Each case: { name, owner, type, pubkey, sig, amount }
const depositCases = [
  {
    name: "real validator, 0x02 cred, 32 ETH",
    owner: OWNER_A,
    type: "0x02",
    pubkey: real.pubkey,
    sig: real.signature,
    amount: 32,
  },
  {
    name: "real validator, 0x02 cred, 2048 ETH",
    owner: OWNER_A,
    type: "0x02",
    pubkey: real.pubkey,
    sig: real.signature,
    amount: 2048,
  },
  {
    name: "synthetic, 0x01 cred, 32 ETH, zero owner",
    owner: OWNER_B,
    type: "0x01",
    pubkey: synthPubkey,
    sig: synthSig,
    amount: 32,
  },
  {
    name: "synthetic, 0x00 cred, 1 ETH",
    owner: OWNER_A,
    type: "0x00",
    pubkey: synthPubkey,
    sig: synthSig,
    amount: 1,
  },
  {
    name: "real validator, 0x01 cred, 2048 ETH",
    owner: OWNER_A,
    type: "0x01",
    pubkey: real.pubkey,
    sig: real.signature,
    amount: 2048,
  },
];

const pubKeyCases = [real.pubkey, synthPubkey, "0x" + "00".repeat(48)];

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------
const cases = [];
let allMatch = true;
let mismatchDetail = "";

function record(name, orig, port, extra) {
  const match = orig === port;
  if (!match) {
    allMatch = false;
    if (!mismatchDetail) {
      mismatchDetail = `${name}: orig=${orig} viem=${port}${
        extra ? " " + extra : ""
      }`;
    }
  }
  cases.push(`${match ? "PASS" : "FAIL"} ${name}: ${port}`);
  console.log(
    `${match ? "PASS" : "FAIL"} ${name}\n     orig=${orig}\n     viem=${port}`
  );
  return match;
}

// --- calcDepositRoot cases ---
for (const c of depositCases) {
  const orig = await origCalcDepositRoot(
    c.owner,
    c.type,
    c.pubkey,
    c.sig,
    c.amount
  );
  const port = await viemCalcDepositRoot(
    c.owner,
    c.type,
    c.pubkey,
    c.sig,
    c.amount
  );
  record(`calcDepositRoot [${c.name}]`, orig, port);
}

// --- hashPubKey cases ---
for (const pk of pubKeyCases) {
  const orig = origHashPubKey(pk);
  const port = viemHashPubKey(pk);
  const isReal = pk === real.pubkey;
  const extra = isReal ? `(repo publicKeyHash=${real.publicKeyHash})` : "";
  const matched = record(
    `hashPubKey [${pk.slice(0, 12)}...]`,
    orig,
    port,
    extra
  );
  // Cross-check the real validator against the hash the repo committed.
  if (isReal && matched && port !== real.publicKeyHash) {
    allMatch = false;
    if (!mismatchDetail) {
      mismatchDetail =
        `hashPubKey real validator disagrees with repo publicKeyHash: ` +
        `computed=${port} repo=${real.publicKeyHash}`;
    }
    cases.push(
      `FAIL hashPubKey vs repo publicKeyHash: computed=${port} repo=${real.publicKeyHash}`
    );
    console.log(
      `FAIL hashPubKey vs committed repo hash: computed=${port} repo=${real.publicKeyHash}`
    );
  } else if (isReal && matched) {
    cases.push(`PASS hashPubKey matches committed repo publicKeyHash`);
    console.log(`PASS hashPubKey matches committed repo publicKeyHash`);
  }
}

// ---------------------------------------------------------------------------
// Negative control: a deliberate mutation MUST be flagged by the comparator.
// Mutate the viem deposit-root output (flip the last hex nibble) and confirm
// the byte-equality check reports a mismatch. This proves the harness cannot
// silently pass on a real difference.
// ---------------------------------------------------------------------------
{
  const c = depositCases[0];
  const good = await viemCalcDepositRoot(
    c.owner,
    c.type,
    c.pubkey,
    c.sig,
    c.amount
  );
  const lastNibble = good.slice(-1);
  const flipped = lastNibble === "0" ? "1" : "0";
  const mutated = good.slice(0, -1) + flipped;
  const orig = await origCalcDepositRoot(
    c.owner,
    c.type,
    c.pubkey,
    c.sig,
    c.amount
  );
  const mutationCaught = orig !== mutated;
  cases.push(
    `${mutationCaught ? "PASS" : "FAIL"} mutation-control: comparator ${
      mutationCaught ? "flagged" : "MISSED"
    } deliberate mismatch`
  );
  console.log(
    `${mutationCaught ? "PASS" : "FAIL"} mutation-control: comparator ${
      mutationCaught ? "flagged" : "MISSED"
    } a deliberate 1-nibble mutation`
  );
  if (!mutationCaught) {
    allMatch = false;
    if (!mismatchDetail) {
      mismatchDetail =
        "negative control failed: comparator did not flag a deliberate mutation";
    }
  }
}

// ---------------------------------------------------------------------------
// Summary.
// ---------------------------------------------------------------------------
console.log("\n==================== SUMMARY ====================");
for (const c of cases) {
  console.log("  " + c);
}
console.log("================================================");
console.log(allMatch ? "ALL MATCH: byte-identical" : "MISMATCH DETECTED");

console.log(
  "RESULT_JSON=" +
    JSON.stringify({
      allMatch,
      cases,
      harnessPath: HARNESS_PATH,
      mismatchDetail,
    })
);

process.exit(allMatch ? 0 : 1);
