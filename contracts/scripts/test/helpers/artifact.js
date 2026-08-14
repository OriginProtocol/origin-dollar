"use strict";

/**
 * Reads a contract's storage layout out of its forge artifact and renders it in
 * a canonical, compilation-stable form.
 *
 * Two traps this exists to avoid:
 *
 * 1. An artifact can be built WITHOUT a storageLayout — a targeted
 *    `forge build <path>` omits it even though foundry.toml sets
 *    `extra_output = ["storageLayout"]`. Observed on OSVault and OETHBaseVault.
 *    A reader that treats the missing key as "no storage" turns the pinning
 *    tests into a permanent pass, so this throws instead.
 * 2. out/ is keyed by source-file BASENAME, so two different .sol files with the
 *    same name collide in one directory (contracts/proxies/Proxies.sol and
 *    tests/utils/artifacts/Proxies.sol already do). Callers pass the expected
 *    fully-qualified name and it is checked.
 */

const fs = require("fs");
const path = require("path");

const CONTRACTS_ROOT = path.join(__dirname, "..", "..", "..");
const OUT = path.join(CONTRACTS_ROOT, "out");

/** `contracts/vault/OUSDVault.sol:OUSDVault` -> out/OUSDVault.sol/OUSDVault.json */
function artifactPath(fqn) {
  const [sourcePath, name] = fqn.split(":");
  return path.join(OUT, path.basename(sourcePath), `${name}.json`);
}

/**
 * Canonical rows: `slot|offset|label|typeLabel|typeBytes`.
 *
 * Deliberately excludes `astId` and the raw `type` id — both embed AST node
 * numbers that shift on unrelated edits (`t_struct(Strategy)5275_storage`), the
 * same instability that makes scripts/check-storage-layout.js false-positive.
 * The resolved label is stable and still carries array lengths, so a gap shrink
 * from `uint256[50]` to `uint256[49]` remains visible.
 */
function pinnedLayout(fqn) {
  const p = artifactPath(fqn);
  if (!fs.existsSync(p)) {
    throw new Error(
      `No artifact at ${path.relative(
        CONTRACTS_ROOT,
        p
      )} for ${fqn} — run \`forge build contracts/\``
    );
  }
  return canonicalise(JSON.parse(fs.readFileSync(p, "utf8")), fqn, p);
}

/** The pure half, so the guards below can be tested without touching out/. */
function canonicalise(artifact, fqn, p = artifactPath(fqn)) {
  const layout = artifact.storageLayout;
  if (!layout || !Array.isArray(layout.storage)) {
    throw new Error(
      `${path.relative(
        CONTRACTS_ROOT,
        p
      )} was built without a storageLayout. ` +
        `A targeted build omits it; run \`forge build contracts/\` (or \`forge clean\` first). ` +
        `Treating this as an empty layout would silently disable the pin.`
    );
  }
  if (layout.storage.length > 0 && layout.storage[0].contract !== fqn) {
    throw new Error(
      `${path.relative(CONTRACTS_ROOT, p)} holds ${
        layout.storage[0].contract
      }, not ${fqn} — ` +
        `out/ is keyed by source basename, so two files of the same name collide`
    );
  }
  return layout.storage.map((row) => {
    const t = layout.types[row.type];
    if (!t) throw new Error(`${fqn}: unresolved type ${row.type}`);
    return [row.slot, row.offset, row.label, t.label, t.numberOfBytes].join(
      "|"
    );
  });
}

const GAP_LABEL = /^_+[a-z]*gap$/i;

/**
 * The slot each gap ends at — where the next variable would land. Returned for
 * every gap, because multi-gap layouts are the norm rather than the exception
 * (WOETH has two, CompoundingStakingSSVStrategy three).
 *
 * Pinning these separately from the rows makes the intent of a carve explicit:
 * shrinking a gap by exactly as many slots as you added leaves its end
 * unchanged, so a correct carve does not touch this assertion while a botched
 * one does.
 */
function gapEnds(fqn) {
  return pinnedLayout(fqn)
    .map((r) => r.split("|"))
    .filter((r) => GAP_LABEL.test(r[2]))
    .map((r) => Number(r[0]) + Number(/\[(\d+)\]/.exec(r[3])[1]));
}

module.exports = {
  pinnedLayout,
  canonicalise,
  gapEnds,
  artifactPath,
  CONTRACTS_ROOT,
};
