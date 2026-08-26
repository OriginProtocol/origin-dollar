"use strict";

/**
 * Policy tests for scripts/lib/storage-upgrade.js — pure, no forge, no fs.
 *
 * The gap arithmetic itself belongs to @openzeppelin/upgrades-core; these cases
 * verify our wiring into it, plus the two rules that are ours alone: gap-label
 * normalisation and the rename filter.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  normaliseGaps,
  isDerivedRename,
  networkFor,
  parseArgs,
  evaluate,
} = require("../lib/storage-upgrade");

const {
  layout,
  gap,
  rename,
  drop,
  insert,
  retype,
  shrinkGap,
  swapLabels,
} = require("./helpers/layout");

/** Run the policy over two layouts; descriptor is synthesised from `baseline`. */
const check = (baseline, candidate, allowBreak = null) =>
  evaluate({
    contract: "C",
    network: "mainnet",
    candidate,
    descriptor: { address: "0xabc", storageLayout: baseline },
    allowBreak,
  });

const passes = (b, c, allowBreak) => check(b, c, allowBreak).ok;

// ── A. Gap carving ───────────────────────────────────────────────────────────

describe("gap carving", () => {
  const base = layout(["owner:t_address", gap(50)]);

  test("identical layouts pass", () => {
    assert.ok(passes(base, base));
  });

  test("append 1 var and shrink the gap by 1", () => {
    assert.ok(passes(base, shrinkGap(insert(base, "__gap", "a:t_uint256"), 1)));
  });

  test("append 2 vars and shrink the gap by 2", () => {
    const two = insert(
      insert(base, "__gap", "a:t_uint256"),
      "__gap",
      "b:t_uint256"
    );
    assert.ok(passes(base, shrinkGap(two, 2)));
  });

  test("shrinking further than the vars added moves the gap end", () => {
    assert.equal(
      passes(base, shrinkGap(insert(base, "__gap", "a:t_uint256"), 2)),
      false
    );
  });

  test("appending without shrinking shifts everything after it", () => {
    assert.equal(passes(base, insert(base, "__gap", "a:t_uint256")), false);
  });

  test("growing the gap is rejected", () => {
    assert.equal(passes(base, shrinkGap(base, -1)), false);
  });

  test("multi-gap layout: shrinking the second gap correctly", () => {
    // the real ARMBuyback shape: ______gap@1 plus __gap later
    const multi = layout([
      "initialized:t_bool",
      gap(50, "______gap"),
      "total:t_uint256",
      gap(41, "__gap"),
    ]);
    assert.ok(passes(multi, multi), "unchanged multi-gap layout");
    const carved = shrinkGap(insert(multi, "__gap", "x:t_uint256"), 1, "__gap");
    assert.ok(passes(multi, carved), "carve from the second gap");
  });
});

// ── B. Gap-label normalisation ───────────────────────────────────────────────

describe("gap-label normalisation", () => {
  test("a deployed ______gap matches a source __gap after a correct carve", () => {
    const deployed = layout(["owner:t_address", gap(50, "______gap")]);
    const source = layout(["owner:t_address", gap(50, "__gap")]);
    assert.ok(passes(deployed, source), "pure relabel");
    const carved = shrinkGap(insert(source, "__gap", "a:t_uint256"), 1);
    assert.ok(passes(deployed, carved), "relabel plus carve");
  });

  for (const label of ["_gap", "___gap", "______igap", "_____ugap"]) {
    test(`${label} is recognised as a gap`, () => {
      const deployed = layout(["owner:t_address", gap(50, label)]);
      const carved = shrinkGap(
        insert(deployed, label, "a:t_uint256"),
        1,
        label
      );
      assert.ok(passes(deployed, carved));
    });
  }

  test("labels that merely contain 'gap' are left alone", () => {
    const out = normaliseGaps(
      layout([
        "gap:t_uint256",
        "gapless:t_uint256",
        "_deprecated_gap:t_uint256",
        "__gap:t_uint256",
      ])
    );
    assert.deepEqual(
      out.storage.map((r) => r.label),
      ["gap", "gapless", "_deprecated_gap", "__gap"]
    );
  });

  test("normaliseGaps does not mutate its input", () => {
    const original = layout(["owner:t_address", gap(50, "______gap")]);
    const snapshot = JSON.stringify(original);
    normaliseGaps(original);
    assert.equal(JSON.stringify(original), snapshot);
  });

  test("normaliseGaps is idempotent and preserves types", () => {
    const l = layout(["owner:t_address", gap(50, "______gap")]);
    const once = normaliseGaps(l);
    assert.deepEqual(normaliseGaps(once), once);
    assert.deepEqual(once.types, l.types);
  });
});

// ── C. Rename policy ─────────────────────────────────────────────────────────

describe("rename policy", () => {
  const base = layout(["assets:t_uint256", "owner:t_address", gap(50)]);

  test("the _deprecated_ convention is accepted, both affixes", () => {
    assert.ok(passes(base, rename(base, "assets", "_deprecated_assets")));
    assert.ok(passes(base, rename(base, "assets", "assets_deprecated")));
  });

  test("an unrelated rename is rejected", () => {
    assert.equal(passes(base, rename(base, "assets", "oToken")), false);
  });

  test("two same-typed variables trading labels is rejected", () => {
    // The fixture shape matters. OZ only classifies a swap as two RENAMES when
    // the variables are separated by another variable; adjacent same-typed ones
    // come back as delete/insert instead. Only the rename form reaches the
    // filter, so this is the shape that actually guards it — with an adjacent
    // pair the test would pass no matter what the filter did.
    const separated = layout([
      "alice:t_address",
      "n:t_uint256",
      "bob:t_address",
      gap(50),
    ]);
    const swapped = swapLabels(separated, "alice", "bob");

    const errors = check(separated, swapped).blocking;
    assert.deepEqual(
      errors.map((e) => e.kind),
      ["rename", "rename"],
      "fixture must produce renames, or it is not testing the filter"
    );
    assert.equal(passes(separated, swapped), false);
  });

  test("a swap between names in a containment relationship is rejected", () => {
    // The one containment alone cannot catch: `token` and `tokenB` each contain
    // the other, so both renames look derived. Only the batch-level check that
    // no rename claims another's old label rejects this. Code reading `token`
    // would otherwise read what used to be `tokenB`.
    const l = layout([
      "token:t_address",
      "n:t_uint256",
      "tokenB:t_address",
      gap(50),
    ]);
    const swapped = swapLabels(l, "token", "tokenB");
    assert.deepEqual(
      check(l, swapped).blocking.map((e) => e.kind),
      ["rename", "rename"],
      "fixture must produce renames, or it is not testing the filter"
    );
    assert.equal(passes(l, swapped), false);
  });

  test("a lone derived rename is still accepted", () => {
    // The batch check must not over-reach: nothing else claims `owner`, so this
    // moves no storage and stays allowed.
    const l = layout(["owner:t_address", "n:t_uint256", gap(50)]);
    assert.ok(passes(l, rename(l, "owner", "ownerAddress")));
  });

  test("a swap of adjacent same-typed variables is also rejected", () => {
    // Same hazard, different OZ classification (delete/insert). Worth pinning
    // both so a change to OZ's diffing cannot quietly open one of them.
    const adjacent = layout(["alice:t_address", "bob:t_address", gap(50)]);
    assert.equal(passes(adjacent, swapLabels(adjacent, "alice", "bob")), false);
  });

  test("a derived rename does not rescue a simultaneous type change", () => {
    const renamed = rename(base, "assets", "_deprecated_assets");
    assert.equal(
      passes(base, retype(renamed, "_deprecated_assets", "t_address")),
      false
    );
  });

  test("bundling a derived rename with a deletion cannot smuggle it through", () => {
    // Worth pinning because it is not obvious: once the layout shifts, OZ stops
    // pairing assets <-> _deprecated_assets as a rename and reports delete +
    // replace instead. So the derived-rename filter never engages here, and a
    // rename cannot be used as cover for a structural change.
    const changed = drop(rename(base, "assets", "_deprecated_assets"), "owner");
    const r = check(base, changed);
    assert.equal(r.ok, false);
    assert.ok(
      r.blocking.every((e) => e.kind !== "rename"),
      "nothing was classified as a rename, so nothing was filtered"
    );
    assert.deepEqual(
      r.blocking.map((e) => e.kind).sort(),
      ["delete", "layoutchange", "replace"],
      "the structural damage surfaces in full"
    );
    assert.doesNotMatch(r.messages.join("\n"), /rename\(s\) ignored/);
  });

  describe("isDerivedRename", () => {
    const ren = (from, to) => ({
      kind: "rename",
      original: { label: from },
      updated: { label: to },
    });

    test("accepts derived, rejects unrelated", () => {
      assert.equal(isDerivedRename(ren("assets", "_deprecated_assets")), true);
      assert.equal(isDerivedRename(ren("Assets", "_DEPRECATED_assets")), true);
      assert.equal(isDerivedRename(ren("oUSD", "oToken")), false);
      assert.equal(isDerivedRename(ren("alice", "bob")), false);
    });

    test("a punctuation-only rename is NOT auto-accepted", () => {
      // Deliberate: it moves nothing, but two variables differing only in
      // punctuation could swap and both would qualify. Costs an
      // _allowStorageBreak rather than risking a silent swap.
      assert.equal(isDerivedRename(ren("_asset", "asset")), false);
    });

    test("non-rename kinds and malformed entries are never derived", () => {
      assert.equal(isDerivedRename({ kind: "delete" }), false);
      assert.equal(isDerivedRename(ren("", "asset")), false);
      assert.equal(isDerivedRename({ kind: "rename" }), false);
      assert.equal(isDerivedRename(null), false);
    });
  });
});

// ── D. Real incompatibilities ────────────────────────────────────────────────

describe("incompatible changes are rejected", () => {
  const base = layout(["a:t_uint256", "b:t_address", "c:t_uint256", gap(50)]);

  test("variable removed", () => {
    assert.equal(passes(base, drop(base, "b")), false);
  });

  test("variable inserted mid-layout", () => {
    assert.equal(passes(base, insert(base, "b", "x:t_uint256")), false);
  });

  test("type widened", () => {
    const packed = layout([{ label: "a", type: "t_uint64" }, "b:t_address"]);
    assert.equal(passes(packed, retype(packed, "a", "t_uint256")), false);
  });

  test("type changed to a different 32-byte type", () => {
    assert.equal(
      passes(base, retype(base, "a", "t_mapping(t_address,t_uint256)")),
      false
    );
  });

  test("variables reordered", () => {
    const reordered = insert(drop(base, "a"), "c", "a:t_uint256");
    assert.equal(passes(base, reordered), false);
  });

  test("offset change within a packed slot", () => {
    const packed = layout([
      { label: "a", type: "t_bool", slot: 0, offset: 0 },
      { label: "b", type: "t_bool", slot: 0, offset: 1 },
    ]);
    const moved = layout([
      { label: "a", type: "t_bool", slot: 0, offset: 1 },
      { label: "b", type: "t_bool", slot: 0, offset: 0 },
    ]);
    assert.equal(passes(packed, moved), false);
  });
});

// ── E. Tolerances and policy branches ────────────────────────────────────────

describe("enum and struct tolerance", () => {
  test("an enum with no member data does not block the upgrade", () => {
    const l = layout(["state:t_enum(RebaseOptions)842", gap(50)]);
    assert.ok(
      passes(l, l),
      "must not report 'Insufficient data to compare enums'"
    );
  });

  test("an enum whose AST id shifted is not a change", () => {
    const before = layout(["state:t_enum(RebaseOptions)842", gap(50)]);
    const after = layout(["state:t_enum(RebaseOptions)91177", gap(50)]);
    assert.ok(passes(before, after), "AST ids shift on unrelated edits");
  });

  test("a struct-typed row compares cleanly", () => {
    const l = layout(["s:t_struct(Strategy)5275_storage", gap(50)]);
    assert.ok(passes(l, l));
  });
});

describe("policy branches", () => {
  const l = layout(["a:t_uint256", gap(50)]);

  test("a candidate declaring no storage passes", () => {
    const r = evaluate({
      contract: "OUSDProxy",
      network: "mainnet",
      candidate: { storage: [], types: {} },
      descriptor: null,
    });
    assert.ok(r.ok);
    assert.match(r.messages.join("\n"), /declares no storage/);
  });

  test("no descriptor means a new contract", () => {
    const r = evaluate({
      contract: "C",
      network: "mainnet",
      candidate: l,
      descriptor: null,
    });
    assert.ok(r.ok);
    assert.match(r.messages.join("\n"), /treated as a new contract/);
  });

  test("a descriptor without a layout fails and names the fix", () => {
    const r = evaluate({
      contract: "C",
      network: "mainnet",
      candidate: l,
      descriptor: { address: "0xabc" },
    });
    assert.equal(r.ok, false);
    assert.match(r.failure, /records no storageLayout/);
    assert.match(r.failure, /seed-descriptor-storage-layouts/);
  });

  test("allowBreak overrides blocking errors and records the reason", () => {
    const r = check(l, drop(l, "a"), "retired deliberately");
    assert.ok(r.ok);
    assert.match(r.messages.join("\n"), /OVERRIDDEN.*retired deliberately/);
  });

  test("allowBreak on a passing contract claims no override", () => {
    const r = check(l, l, "not needed");
    assert.ok(r.ok);
    assert.doesNotMatch(r.messages.join("\n"), /OVERRIDDEN/);
  });

  test("a row with no slot renders as ? rather than throwing", () => {
    // real: deployments/mainnet/OUSDReset.json has a gap with slot undefined
    const odd = {
      storage: [{ label: "x", offset: 0, type: "t_uint256" }],
      types: {},
    };
    const r = evaluate({
      contract: "C",
      network: "mainnet",
      candidate: odd,
      descriptor: { address: "0xabc", storageLayout: layout(["y:t_address"]) },
    });
    assert.equal(r.ok, false);
    assert.doesNotThrow(() => r.messages.join("\n"));
  });
});

// ── Argument and chain handling ──────────────────────────────────────────────

describe("networkFor", () => {
  test("maps only the gated chains", () => {
    assert.equal(networkFor(1), "mainnet");
    assert.equal(networkFor(8453), "base");
    for (const id of [10, 31337, 0, 999, 146]) {
      assert.equal(networkFor(id), undefined, `chain ${id} must not be gated`);
    }
  });
});

describe("parseArgs", () => {
  const argv = (...rest) => ["node", "script", ...rest];

  test("parses a full invocation", () => {
    assert.deepEqual(parseArgs(argv("--contract", "X", "--chain-id", "1")), {
      contract: "X",
      chainId: 1,
      allowBreak: null,
    });
  });

  test("keeps a multi-word reason verbatim", () => {
    const reason = 'slots 51/64/72 retired; "deliberately"';
    assert.equal(
      parseArgs(
        argv("--contract", "X", "--chain-id", "1", "--allow-break", reason)
      ).allowBreak,
      reason
    );
  });

  test("rejects malformed invocations", () => {
    for (const args of [
      ["--contract", "X"],
      ["--chain-id", "1"],
      ["--contract", "X", "--chain-id", "1", "--bogus"],
      ["--contract", "X", "--chain-id", "0"],
      ["--contract", "X", "--chain-id", "abc"],
      ["--chain-id", "1", "--contract"],
    ]) {
      assert.throws(
        () => parseArgs(argv(...args)),
        `should reject: ${args.join(" ")}`
      );
    }
  });
});
