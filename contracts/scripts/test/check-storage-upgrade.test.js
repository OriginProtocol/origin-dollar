"use strict";

/**
 * Black-box tests for scripts/check-storage-upgrade.js.
 *
 * The contract this file exists to protect: AbstractDeployScript._checkStorage
 * does `require(keccak256(vm.ffi(cmd)) == keccak256(bytes("OK")))`, so the gate's
 * agreement with Solidity is two bytes on stdout. @openzeppelin/upgrades-core
 * prints advisory notes when `unsafeAllowCustomTypes` is set — today to stderr,
 * which is the only reason deploys work. If a future bump routes those to stdout,
 * every _recordDeployment on mainnet and Base fails with an error blaming storage
 * layout rather than a library log. test_stdout_isOnlyOK_evenWhenOzLogs is that
 * guard; do not weaken it.
 *
 * `forge` is faked via a shim on PATH (see helpers/cli.js), so these run with no
 * Foundry toolchain and no build.
 */

const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  runCli,
  cleanup,
  baselineOf,
  descriptorWithoutLayout,
  CONTRACTS_ROOT,
} = require("./helpers/cli");

after(cleanup);

const layoutJson = (layout) => JSON.stringify(layout);

/** A baseline that is guaranteed to match itself, whatever the descriptor holds. */
const OUSD_VAULT = baselineOf("OUSDVault");

const clone = (o) => JSON.parse(JSON.stringify(o));

// ── The stdout contract ──────────────────────────────────────────────────────

test("stdout is exactly OK on a passing run", () => {
  const r = runCli({
    args: ["--contract", "OUSDVault", "--chain-id", "1"],
    forge: { stdout: layoutJson(OUSD_VAULT) },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "OK");
  assert.equal(Buffer.byteLength(r.stdout), 2, "no trailing newline");
});

test("stdout is only OK even when upgrades-core logs advisory notes", () => {
  // OUSDVault has struct/enum-typed rows, so this run exercises the
  // unsafeAllowCustomTypes path that makes upgrades-core emit a Note/Warning.
  const r = runCli({
    args: ["--contract", "OUSDVault", "--chain-id", "1"],
    forge: { stdout: layoutJson(OUSD_VAULT) },
  });
  assert.equal(r.stdout, "OK");
  assert.doesNotMatch(r.stdout, /Note:|Warning:/);
  assert.doesNotMatch(r.stdout, /\n/);
  // and prove the notes really are being produced, just not on stdout
  assert.match(r.stderr, /unsafeAllowCustomTypes|Potentially unsafe/);
});

test("stdout is empty on a failing run, never a partial OK", () => {
  const broken = clone(OUSD_VAULT);
  broken.storage.shift(); // drop a row -> every later slot shifts
  const r = runCli({
    args: ["--contract", "OUSDVault", "--chain-id", "1"],
    forge: { stdout: layoutJson(broken) },
  });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /NOT upgrade-safe/i);
});

// ── CLI plumbing ─────────────────────────────────────────────────────────────

test("a non-gated chain passes without ever invoking forge", () => {
  const r = runCli({ args: ["--contract", "OUSDVault", "--chain-id", "10"] });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "OK");
  assert.deepEqual(r.forgeCalls, [], "forge must not run for an ungated chain");
});

test("forge is invoked with exactly the expected argv", () => {
  const r = runCli({
    args: ["--contract", "OUSDVault", "--chain-id", "1"],
    forge: { stdout: layoutJson(OUSD_VAULT) },
  });
  assert.equal(r.forgeCalls.length, 1);
  assert.deepEqual(r.forgeCalls[0], [
    "inspect",
    "OUSDVault",
    "storageLayout",
    "--json",
  ]);
});

test("a forge failure surfaces its first stderr line and fails", () => {
  const r = runCli({
    args: ["--contract", "OUSDVault", "--chain-id", "1"],
    forge: { exit: 1, stderr: "Error: storage layout missing from artifact" },
  });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /forge inspect OUSDVault failed/);
});

test("compiler chatter before the JSON is tolerated", () => {
  const r = runCli({
    args: ["--contract", "OUSDVault", "--chain-id", "1"],
    forge: {
      stdout: `Compiling 1 files with 0.8.28\n${layoutJson(OUSD_VAULT)}`,
    },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "OK");
});

test("malformed forge output fails rather than passing vacuously", () => {
  for (const stdout of ["no json here", '{"storage": null}']) {
    const r = runCli({
      args: ["--contract", "OUSDVault", "--chain-id", "1"],
      forge: { stdout },
    });
    assert.equal(r.status, 1, `should fail for: ${stdout}`);
    assert.equal(r.stdout, "");
  }
});

test("bad arguments exit 1 without emitting OK", () => {
  const cases = [
    ["--contract", "OUSDVault"], // no --chain-id
    ["--chain-id", "1"], // no --contract
    ["--contract", "OUSDVault", "--chain-id", "1", "--bogus"],
    ["--contract", "OUSDVault", "--chain-id", "0"],
    ["--contract", "OUSDVault", "--chain-id", "abc"],
  ];
  for (const args of cases) {
    const r = runCli({ args });
    assert.equal(r.status, 1, `should fail for: ${args.join(" ")}`);
    assert.equal(r.stdout, "");
  }
});

// ── Policy branches, end to end ──────────────────────────────────────────────

test("a contract with no descriptor is treated as new", () => {
  const r = runCli({
    args: ["--contract", "NoSuchContractXyz", "--chain-id", "1"],
    forge: { stdout: layoutJson(OUSD_VAULT) },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "OK");
  assert.match(r.stderr, /treated as a new contract/);
});

test("a contract declaring no storage passes", () => {
  const r = runCli({
    args: ["--contract", "OUSDProxy", "--chain-id", "1"],
    forge: { stdout: '{"storage":[],"types":{}}' },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "OK");
  assert.match(r.stderr, /declares no storage/);
});

test("a descriptor with no recorded layout fails loudly", (t) => {
  const name = descriptorWithoutLayout();
  if (!name) {
    t.skip("every mainnet descriptor now carries a storageLayout");
    return;
  }
  const r = runCli({
    args: ["--contract", name, "--chain-id", "1"],
    forge: { stdout: layoutJson(OUSD_VAULT) },
  });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /records no storageLayout/);
  assert.match(r.stderr, /seed-descriptor-storage-layouts/, "names the fix");
});

test("--allow-break converts a failure into a pass and says so", () => {
  const broken = clone(OUSD_VAULT);
  broken.storage.shift();
  const r = runCli({
    args: [
      "--contract",
      "OUSDVault",
      "--chain-id",
      "1",
      "--allow-break",
      "slots retired deliberately",
    ],
    forge: { stdout: layoutJson(broken) },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "OK");
  assert.match(r.stderr, /OVERRIDDEN/);
  assert.match(r.stderr, /slots retired deliberately/);
});

test("--allow-break on a passing contract does not claim an override", () => {
  const r = runCli({
    args: [
      "--contract",
      "OUSDVault",
      "--chain-id",
      "1",
      "--allow-break",
      "not actually needed",
    ],
    forge: { stdout: layoutJson(OUSD_VAULT) },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "OK");
  assert.doesNotMatch(
    r.stderr,
    /OVERRIDDEN/,
    "deploy log must not report an override that never happened"
  );
});

test("--chain-id 8453 resolves the base descriptor directory", () => {
  const r = runCli({
    args: ["--contract", "OETHBase", "--chain-id", "8453"],
    forge: { stdout: layoutJson(baselineOf("OETHBase", "base")) },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "OK");
  assert.match(r.stderr, /base/);
});

// ── Cross-language wire contract ─────────────────────────────────────────────

test("AbstractDeployScript still speaks this script's protocol", () => {
  const sol = fs.readFileSync(
    path.join(
      CONTRACTS_ROOT,
      "scripts/deploy/helpers/AbstractDeployScript.s.sol"
    ),
    "utf8"
  );
  assert.match(
    sol,
    /keccak256\(bytes\("OK"\)\)/,
    "Solidity no longer compares against the OK sentinel this script emits"
  );
  assert.match(sol, /scripts\/check-storage-upgrade\.js/);
  for (const flag of ["--contract", "--chain-id", "--allow-break"]) {
    assert.ok(sol.includes(`"${flag}"`), `Solidity stopped passing ${flag}`);
  }
});
