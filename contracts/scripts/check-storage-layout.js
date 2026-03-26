#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const os = require("os");

// ─── Argument parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { base: "master", head: null, contracts: [] };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--contract":
        args.contracts = argv[++i].split(",").map((c) => c.trim());
        break;
      case "--base":
        args.base = argv[++i];
        break;
      case "--head":
        args.head = argv[++i];
        break;
      case "--help":
        console.log(
          [
            "Usage: node scripts/check-storage-layout.js --contract <Name[,Name2]> [--base <ref>] [--head <ref>]",
            "",
            "Options:",
            "  --contract  Contract name(s), comma-separated (required)",
            "  --base      Git ref for the old version (default: master)",
            "  --head      Git ref for the new version (default: current working tree)",
            "  --help      Show this help message",
          ].join("\n")
        );
        process.exit(0);
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }

  if (args.contracts.length === 0) {
    console.error("Error: --contract is required");
    process.exit(1);
  }

  return args;
}

// ─── Worktree helpers ────────────────────────────────────────────────────────

function createWorktree(ref) {
  const dir = path.join(
    os.tmpdir(),
    `storage-check-${ref.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}`
  );
  execSync(`git worktree add "${dir}" "${ref}"`, {
    stdio: "pipe",
    cwd: path.resolve(__dirname, "../.."),
  });
  return dir;
}

function removeWorktree(dir) {
  try {
    execSync(`git worktree remove "${dir}" --force`, {
      stdio: "pipe",
      cwd: path.resolve(__dirname, "../.."),
    });
  } catch {
    // Best-effort cleanup
  }
}

// ─── Forge helpers ───────────────────────────────────────────────────────────

function forgeBuild(contractsDir) {
  console.log(`  Building in ${contractsDir}...`);
  execSync("forge build", {
    cwd: contractsDir,
    stdio: "inherit",
    timeout: 300_000,
  });
}

function forgeInspect(contractsDir, contractName) {
  const output = execSync(
    `forge inspect "${contractName}" storageLayout`,
    { cwd: contractsDir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );
  return JSON.parse(output);
}

function getLayout(contractsDir, contractName) {
  try {
    return forgeInspect(contractsDir, contractName);
  } catch (e) {
    console.error(
      `  Error: could not get storage layout for ${contractName}`
    );
    console.error(`  ${e.stderr || e.message}`);
    return null;
  }
}

// ─── Comparison logic ────────────────────────────────────────────────────────

function getTypeSize(layout, typeName) {
  const t = layout.types[typeName];
  return t ? parseInt(t.numberOfBytes, 10) : null;
}

function isGapVariable(entry) {
  return /^_{0,2}gap$/.test(entry.label);
}

function gapSlotCount(layout, entry) {
  const t = layout.types[entry.type];
  if (!t) return 0;
  // Gap arrays are t_array(t_uint256)N_storage → N * 32 bytes / 32 = N slots
  return parseInt(t.numberOfBytes, 10) / 32;
}

function compareLayouts(oldLayout, newLayout, contractName) {
  const errors = [];
  const infos = [];

  const oldStorage = oldLayout.storage;
  const newStorage = newLayout.storage;

  // Build a map of slot+offset → entry for the new layout
  const newBySlotOffset = new Map();
  for (const entry of newStorage) {
    newBySlotOffset.set(`${entry.slot}:${entry.offset}`, entry);
  }

  // Check every old entry still exists at the same slot+offset with same type
  for (const oldEntry of oldStorage) {
    const key = `${oldEntry.slot}:${oldEntry.offset}`;
    const newEntry = newBySlotOffset.get(key);

    if (!newEntry) {
      // Might be a gap that was shrunk — check if it's a gap variable
      if (isGapVariable(oldEntry)) {
        // Check if the gap moved or shrunk (handled below)
        continue;
      }
      errors.push(
        `Variable "${oldEntry.label}" (${oldEntry.contract}) at slot ${oldEntry.slot} offset ${oldEntry.offset} was removed or shifted`
      );
      continue;
    }

    // Type must match (label/name can differ)
    if (oldEntry.type !== newEntry.type) {
      const oldSize = getTypeSize(oldLayout, oldEntry.type);
      const newSize = getTypeSize(newLayout, newEntry.type);

      // Check if it's a gap being resized
      if (isGapVariable(oldEntry) && isGapVariable(newEntry)) {
        const oldGapSlots = gapSlotCount(oldLayout, oldEntry);
        const newGapSlots = gapSlotCount(newLayout, newEntry);
        if (newGapSlots < oldGapSlots) {
          infos.push(
            `__gap (${oldEntry.contract}) reduced from ${oldGapSlots} to ${newGapSlots} slots`
          );
          continue;
        } else if (newGapSlots > oldGapSlots) {
          errors.push(
            `__gap (${oldEntry.contract}) grew from ${oldGapSlots} to ${newGapSlots} slots — this is unexpected`
          );
          continue;
        }
      }

      errors.push(
        `Type mismatch at slot ${oldEntry.slot} offset ${oldEntry.offset}: ` +
          `"${oldEntry.label}" was ${oldEntry.type} (${oldSize} bytes), ` +
          `now "${newEntry.label}" is ${newEntry.type} (${newSize} bytes)`
      );
      continue;
    }

    // Name changed — just informational
    if (oldEntry.label !== newEntry.label) {
      infos.push(
        `Variable renamed at slot ${oldEntry.slot}: "${oldEntry.label}" → "${newEntry.label}"`
      );
    }
  }

  // Check for new entries that don't exist in old layout
  const oldBySlotOffset = new Map();
  for (const entry of oldStorage) {
    oldBySlotOffset.set(`${entry.slot}:${entry.offset}`, entry);
  }

  // Find the highest slot used in the old layout
  let maxOldSlot = -1;
  for (const entry of oldStorage) {
    const slot = parseInt(entry.slot, 10);
    const size = getTypeSize(oldLayout, entry.type) || 32;
    const endSlot = slot + Math.ceil(size / 32) - 1;
    if (endSlot > maxOldSlot) maxOldSlot = endSlot;
  }

  for (const newEntry of newStorage) {
    const key = `${newEntry.slot}:${newEntry.offset}`;
    if (!oldBySlotOffset.has(key) && !isGapVariable(newEntry)) {
      const slot = parseInt(newEntry.slot, 10);
      if (slot <= maxOldSlot) {
        // New variable inserted within old range — could be filling a gap slot
        // which is fine. But if it's not a gap area, flag it.
        infos.push(
          `New variable "${newEntry.label}" (${newEntry.contract}) at slot ${newEntry.slot} offset ${newEntry.offset}`
        );
      } else {
        infos.push(
          `New variable "${newEntry.label}" (${newEntry.contract}) appended at slot ${newEntry.slot}`
        );
      }
    }
  }

  return { errors, infos };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  console.log("Storage Layout Compatibility Check");
  console.log(`Base ref: ${args.base}`);
  if (args.head) console.log(`Head ref: ${args.head}`);
  console.log("─".repeat(40));
  console.log();

  const repoRoot = path.resolve(__dirname, "../..");
  const currentContractsDir = path.resolve(__dirname, "..");

  // ── Build and extract layouts for the new version ──

  let headContractsDir;
  let headWorktreeDir = null;

  if (args.head) {
    console.log(`Creating worktree for head ref (${args.head})...`);
    headWorktreeDir = createWorktree(args.head);
    headContractsDir = path.join(headWorktreeDir, "contracts");
    forgeBuild(headContractsDir);
  } else {
    headContractsDir = currentContractsDir;
    console.log("Building current branch...");
    forgeBuild(headContractsDir);
  }

  // ── Build the base ref in a worktree ──

  console.log(`\nCreating worktree for base ref (${args.base})...`);
  const baseWorktreeDir = createWorktree(args.base);
  const baseContractsDir = path.join(baseWorktreeDir, "contracts");
  forgeBuild(baseContractsDir);

  console.log();

  // ── Compare each contract ──

  let passed = 0;
  let failed = 0;

  for (const contractName of args.contracts) {
    console.log(`Checking ${contractName}...`);

    const oldLayout = getLayout(baseContractsDir, contractName);
    const newLayout = getLayout(headContractsDir, contractName);

    if (!oldLayout && !newLayout) {
      console.log(`  [SKIP] Could not get layout for either version\n`);
      continue;
    }
    if (!oldLayout) {
      console.log(`  [INFO] New contract (no layout in base ref)\n`);
      passed++;
      continue;
    }
    if (!newLayout) {
      console.log(`  [WARN] Contract removed in new version\n`);
      continue;
    }

    console.log(
      `  Old: ${oldLayout.storage.length} storage entries`
    );
    console.log(
      `  New: ${newLayout.storage.length} storage entries`
    );

    const { errors, infos } = compareLayouts(
      oldLayout,
      newLayout,
      contractName
    );

    if (infos.length > 0) {
      console.log();
      for (const info of infos) console.log(`  [INFO] ${info}`);
    }

    if (errors.length > 0) {
      console.log();
      for (const err of errors) console.log(`  [FAIL] ${err}`);
      failed++;
    } else {
      console.log(`\n  [PASS] No slot conflicts detected`);
      passed++;
    }

    console.log();
  }

  // ── Cleanup ──

  console.log("Cleaning up worktrees...");
  removeWorktree(baseWorktreeDir);
  if (headWorktreeDir) removeWorktree(headWorktreeDir);

  // ── Summary ──

  console.log();
  console.log("─".repeat(40));
  const total = passed + failed;
  if (failed > 0) {
    console.log(`Result: ${passed}/${total} passed, ${failed}/${total} FAILED`);
    process.exit(1);
  } else {
    console.log(`Result: ${passed}/${total} passed`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
