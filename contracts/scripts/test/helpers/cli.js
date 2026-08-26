"use strict";

/**
 * Runs scripts/check-storage-upgrade.js as a subprocess with a fake `forge` on
 * PATH, so the black-box tests need neither a Foundry toolchain nor a build.
 *
 * The script invokes `execFileSync("forge", ...)` by bare name, so prepending a
 * temp directory to PATH is enough to intercept it. The shim records its argv,
 * which lets a test assert that `forge` was never called at all — the only way
 * to prove the pre-forge return path really returns early.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const CONTRACTS_ROOT = path.join(__dirname, "..", "..", "..");
const SCRIPT = path.join(CONTRACTS_ROOT, "scripts", "check-storage-upgrade.js");

const tempDirs = [];

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** Remove every temp dir this module created. Call from an `after()` hook. */
function cleanup() {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
}

/**
 * @param {object} opts
 * @param {string[]} opts.args        argv for the script
 * @param {object}  [opts.forge]      shim behaviour
 * @param {string}  [opts.forge.stdout]  literal stdout (usually a layout JSON)
 * @param {string}  [opts.forge.stderr]
 * @param {number}  [opts.forge.exit]
 * @returns {{status:number, stdout:string, stderr:string, forgeCalls:string[][]}}
 */
function runCli({ args, forge = {} }) {
  const shimDir = tempDir("forge-shim-");
  const callLog = path.join(shimDir, "calls.log");
  const stdoutFile = path.join(shimDir, "stdout.txt");
  fs.writeFileSync(stdoutFile, forge.stdout ?? "");

  // `printf %s` rather than `echo` so payloads are emitted byte-exactly, with
  // no trailing newline of the shim's own invention.
  fs.writeFileSync(
    path.join(shimDir, "forge"),
    [
      "#!/bin/sh",
      `printf '%s\\n' "$*" >> "${callLog}"`,
      `cat "${stdoutFile}"`,
      forge.stderr ? `printf '%s\\n' ${JSON.stringify(forge.stderr)} >&2` : "",
      `exit ${forge.exit ?? 0}`,
      "",
    ].join("\n"),
    { mode: 0o755 }
  );

  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: CONTRACTS_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${shimDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  const forgeCalls = fs.existsSync(callLog)
    ? fs
        .readFileSync(callLog, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => line.split(" "))
    : [];

  return {
    status: res.status,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    forgeCalls,
  };
}

/** The recorded storageLayout of a real descriptor, as the gate's baseline. */
function baselineOf(name, network = "mainnet") {
  const p = path.join(CONTRACTS_ROOT, "deployments", network, `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8")).storageLayout;
}

/** First descriptor with an address but no recorded layout, or null. */
function descriptorWithoutLayout(network = "mainnet") {
  const dir = path.join(CONTRACTS_ROOT, "deployments", network);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    let d;
    try {
      d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch {
      continue;
    }
    if (d.address && !d.storageLayout) return f.slice(0, -5);
  }
  return null;
}

module.exports = {
  runCli,
  cleanup,
  baselineOf,
  descriptorWithoutLayout,
  CONTRACTS_ROOT,
};
