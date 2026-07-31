---
name: organize-test
description: Reorganize Foundry test files (*.t.sol) for readability and consistency without changing semantics. Use when the user asks to organize, reorder, clean up, tidy, or reformat a test file's structure.
---

# Organize Test

Reorganize an existing Foundry test file (`*.t.sol`) so that imports, state variables, and functions follow the repository's established conventions. This skill makes **purely structural changes** — it never alters logic, assertions, values, names, or execution order.

---

## 0. Safety Guardrails — NEVER Violate

These rules are absolute. If any rule would be violated by a proposed change, **skip that change entirely**.

1. **Scope**: Only modify files matching `*.t.sol` inside `contracts/tests/`. NEVER touch production contracts, deploy scripts, or Hardhat test files.
2. **No semantic changes**: Never modify function bodies, assertions, require/revert strings, call arguments, numeric values, or conditional logic.
3. **No renames**: Never rename functions, variables, contracts, structs, enums, events, or errors.
4. **No additions or removals**: Never add or remove imports, functions, state variables, or modifiers. Only reorder existing ones.
5. **No visibility/type changes**: Never change visibility (`public`/`internal`/`private`), mutability (`constant`/`immutable`), types, or inheritance lists.
6. **Preserve comments**: Move comments with their associated code. Never delete, rewrite, or add comments (except section dividers — see Section 5).
7. **Preserve blank-line semantics**: Keep logical blank-line separations inside function bodies untouched.
8. **Skip if risky**: If a reorganization is ambiguous, could affect behavior, or would produce a diff that is hard to review (>60% of lines changed), make the smallest safe change or do nothing.

---

## 1. Pre-Edit Checklist

Before making any edit, complete every item:

- [ ] Confirm the target file is `*.t.sol` under `contracts/tests/`.
- [ ] Read the entire file to understand its current structure.
- [ ] Identify the file type: **Shared** (`Shared.t.sol`), **Concrete** (concrete test), **Fuzz** (fuzz test), or **Base** (`Base.t.sol`, `BaseFork.t.sol`, `BaseSmoke.t.sol`).
- [ ] Check for any repo-specific conventions in the file that diverge from the defaults below. If present, **respect the local convention**.
- [ ] Plan all moves mentally before editing. Each move must be a pure relocation — same content, new position.

---

## 2. Import Ordering

Organize imports into groups separated by a single blank line. Within each group, sort alphabetically by the imported symbol name (the name inside `{}`).

### Group order

Each import group gets a named section header comment. Use the format `// --- <Group Name>` to label each group.

```solidity
// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";
import {Fork_SomeStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";
import {Sonic} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
```

### Standard import section names

| Section | Contents |
|---|---|
| `Test base` | Parent shared contract, Base.t.sol |
| `Test utilities` | Address registries (`tests/utils/Addresses.sol`), test helpers |
| `External libraries` | forge-std, OpenZeppelin, Solmate, etc. |
| `Project imports` | Interfaces, contracts, and mocks from `contracts/` |

If Group 4 is large and mixes interfaces with mocks/implementations, split it into two named sections: `Project interfaces` and `Project contracts`.

### Rules

- If a group has only one import, it still gets its own group with surrounding blank lines.
- If the file already uses meaningful sub-groups within Group 4 (e.g., interfaces separated from mocks), preserve that finer grouping.
- Never merge Group 1 with any other group — the parent test import must always be visually distinct at the top.
- If an import does not clearly belong to any group, leave it in its current position relative to its neighbors.

---

## 3. State Variable Organization

State variables must be organized into **sections** using the repo's standard section divider (see Section 5). Each section groups variables by semantic role.

### Section order

1. **CONSTANTS** — `constant` variables, then `immutable` variables.
2. **CONTRACTS** — Interface-typed contract references (`IVault`, `IOToken`, `IAMOStrategy`, etc.), then mock contracts.
3. **ACTORS** — `address` variables for test actors (only if the file declares actors beyond what `Base.t.sol` provides).
4. **EXTERNAL TOKENS** — `IERC20` references for external tokens (only if the file declares tokens beyond what `Base.t.sol` provides).
5. **FORK IDS** — `uint256` fork ID variables (only in Base-level files).
6. **CONFIGURATION** — Mutable state used for test configuration (thresholds, amounts, flags).

### Ordering within a section

1. `constant` before `immutable` before mutable.
2. Within the same modifier group, alphabetical by variable name.
3. If the existing file uses a different but consistent internal order (e.g., grouped by contract relationship), preserve it.

### When to add section dividers

- If the file already uses section dividers, reorganize variables into the correct sections.
- If the file has **no** section dividers but has 6+ state variables, add dividers for the sections that apply.
- If the file has fewer than 6 state variables and no existing dividers, do **not** add dividers — the overhead is not worth it.

### Example

```solidity
abstract contract Fork_SomeStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant DEFAULT_AMOUNT = 1_000e18;
    address internal constant DEAD_ADDRESS = address(0xdead);

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IAMOStrategy internal amoStrategy;
    IOToken internal otoken;
    IVault internal vault;
    MockERC20 internal mockToken;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        // ...
    }
}
```

---

## 4. Function Ordering

Function ordering depends on the file type.

### 4a. Shared files (`Shared.t.sol`, base test contracts)

Every function group gets its own section divider (54-slash format from Section 5):

```solidity
    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override { ... }
    function _deployContracts() internal { ... }
    function _configureContracts() internal { ... }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _depositAsVault(uint256 amount) internal { ... }
    function _verifyEndConditions() internal view { ... }

    //////////////////////////////////////////////////////
    /// --- ASSERTION HELPERS
    //////////////////////////////////////////////////////

    function _assertBalances(uint256 expected) internal view { ... }

    //////////////////////////////////////////////////////
    /// --- CALLBACKS
    //////////////////////////////////////////////////////

    function onERC721Received(...) external returns (bytes4) { ... }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function _labelContracts() internal { ... }
```

Ordering within SETUP: `setUp()` first, then deployment/fetch helpers in the order they are called by setUp (`_deployContracts`, `_deployMockContracts`, `_configureContracts`, `_fetchContracts`, `_resolveActors`, `_fundInitialUsers`).

Omit a section divider if the section would be empty. Merge ASSERTION HELPERS into HELPERS if there are only 1-2 assertion helpers.

### 4b. Concrete test files

Every test group gets its own section divider:

```solidity
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_deposit() public { ... }
    function test_deposit_checkBalanceReflectsDeposit() public { ... }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_deposit_RevertWhen_paused() public { ... }
    function test_deposit_RevertWhen_zeroAmount() public { ... }

    //////////////////////////////////////////////////////
    /// --- EVENT TESTS
    //////////////////////////////////////////////////////

    function test_deposit_emitsDeposit() public { ... }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _prepareDeposit(uint256 amount) internal { ... }
```

If the file tests multiple functions (common in `ViewFunctions.t.sol` or `Admin.t.sol`), use a section divider **per function** (e.g., `/// --- MINT`, `/// --- REDEEM`), each following the passing → reverting → event order internally.

### 4c. Fuzz test files

Same section divider convention:

```solidity
    //////////////////////////////////////////////////////
    /// --- FUZZ TESTS
    //////////////////////////////////////////////////////

    function testFuzz_deposit_correctBalance(uint256 amount) public { ... }
    function testFuzz_deposit_neverExceedsMax(uint256 amount) public { ... }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _boundAmount(uint256 amount) internal pure returns (uint256) { ... }
```

If the file has enough fuzz tests to warrant sub-groups, split into `BASIC PROPERTIES` and `COMPOUND PROPERTIES`.

### Ordering tests within a section

- Within the same section, preserve the existing order unless there is a clear improvement (e.g., grouping tests for the same sub-behavior together).
- **Never reorder tests if the order could matter** (e.g., sequential state changes in a stateful test contract — rare but possible).

---

## 5. Section Divider Convention

The repo uses this exact format:

```
//////////////////////////////////////////////////////
/// --- SECTION_NAME
//////////////////////////////////////////////////////
```

- Top/bottom lines: exactly 54 forward slashes (`/`).
- Middle line: `/// --- ` followed by the section name in `ALL_CAPS`.
- One blank line after the closing divider before the first item.
- One blank line before the opening divider (except at the very start of the contract body).

### Standard section names

| Section | Used in |
|---|---|
| `CONSTANTS` | Shared, Base |
| `CONTRACTS` | Shared |
| `CONTRACTS & MOCKS` | Shared (unit tests with mocks) |
| `ACTORS` | Base, Shared |
| `EXTERNAL TOKENS` | Base |
| `FORK IDS` | Base |
| `SETUP` | Shared |
| `HELPERS` | Shared, Concrete, Fuzz |
| `PASSING TESTS` | Concrete |
| `REVERTING TESTS` | Concrete |
| `LABELS` | Shared (when _labelContracts is present) |
| `CONFIGURATION` | Shared (when config variables exist) |

If the file uses a custom section name that is clear and descriptive, keep it. Only rename section headers when they are misleading.

---

## 6. When NOT to Apply This Skill

**Do not reorganize** if any of these conditions hold:

- The file is **not** a `*.t.sol` file under `contracts/tests/`.
- The file is a **production contract** (`contracts/` outside `tests/`), a deploy script, or a Hardhat JS/TS test.
- The file contains inline assembly (`assembly { ... }`) interleaved with state variable declarations — moving variables could change storage layout.
- The file is **auto-generated** or clearly marked as such.
- The reorganization would produce a diff affecting **more than 60%** of the file's lines — this makes review impractical. In this case, do the smallest safe subset or nothing.
- The file's structure is **ambiguous or highly mixed** (e.g., helpers scattered between tests with unclear dependencies) — do only the clearly safe moves.
- Moving a comment would **separate it from the code it documents** in a way that loses meaning.
- The file already **perfectly follows** all conventions — do nothing, report that the file is clean.

---

## 7. Post-Edit Verification

After all edits are complete:

1. Run `forge b` from `contracts/` to confirm compilation.
2. Run `forge fmt tests/ scripts/` from `contracts/` to ensure formatting is consistent.
3. Review the diff: **every change must be a pure move** — same content, different position. If any content change appears, revert it.
4. If compilation fails after reorganization, revert all changes immediately and report the failure.

---

## 8. Final Checklist

Before reporting completion, verify every item:

- [ ] Target file is `*.t.sol` under `contracts/tests/`
- [ ] No production contract files were modified
- [ ] Imports are grouped and sorted per Section 2
- [ ] State variables are in section-divided groups per Section 3
- [ ] Functions follow the ordering rules for the file type per Section 4
- [ ] All section dividers use the exact 54-slash format per Section 5
- [ ] No function bodies, assertions, or logic were changed
- [ ] No variables were renamed, added, or removed
- [ ] No imports were added or removed (only reordered)
- [ ] All comments moved with their associated code
- [ ] `forge b` passes
- [ ] `forge fmt tests/ scripts/` runs cleanly
- [ ] Diff contains only structural moves, no semantic changes

---

## 9. Operational Flow Summary

```
1. User provides a test file path (or asks to organize a test file)
2. READ the entire file
3. CLASSIFY the file type (Shared / Concrete / Fuzz / Base)
4. CHECK pre-edit checklist (Section 1)
5. PLAN all moves (imports → variables → functions)
6. EDIT the file — imports first, then state variables, then functions
7. VERIFY — forge b, forge fmt, review diff
8. REPORT what was changed (or that the file was already clean)
```

If at any point a move feels unsafe, **skip it** and note it in the report.
