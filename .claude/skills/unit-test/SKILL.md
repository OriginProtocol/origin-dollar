---
description: Generate Foundry unit tests (concrete + fuzz) for a contract following our established conventions
user_invocable: true
argument: ContractName — the contract to generate tests for (e.g. OUSDVault, OUSD, AMO)
---

# Unit Test Skill

Generate Foundry unit tests for `$ARGUMENTS` following the project's established patterns.
Before writing any code, read the existing tests under `contracts/tests/unit/vault/OUSDVault/` to absorb the exact style, then apply it to the target contract.

## 1. Directory Layout

```
contracts/tests/unit/<category>/<ContractName>/
├── shared/
│   └── Shared.sol          # Abstract base with setUp, mocks, helpers
├── concrete/
│   ├── FunctionA.t.sol     # One file per public/external function
│   ├── FunctionB.t.sol
│   └── ViewFunctions.t.sol # Exception: all view/pure functions grouped in one file
└── fuzz/
    ├── FunctionA.fuzz.t.sol # Property-based tests per function
    └── FunctionB.fuzz.t.sol
```

`<category>` matches the subdirectories already in `contracts/tests/unit/` (vault, token, strategies, oracle, etc.).

### One file per function rule

Each public/external **state-changing** function gets its own dedicated test file, named after the function in PascalCase (e.g. `rebaseOptIn()` → `RebaseOptIn.t.sol`, `delegateYield()` → `DelegateYield.t.sol`).

**Exceptions** (may be grouped into a single file):
- **View/pure functions** → group in `ViewFunctions.t.sol`
- **Setter functions** (governor/admin config) → group in `Admin.t.sol` or `Config.t.sol`

**Do NOT** group multiple distinct functions in one file just because they are thematically related. For example, `rebaseOptIn()` and `rebaseOptOut()` are two separate functions and must have two separate files, even though they are conceptually related.

## 2. Inheritance Chain

```
forge-std/Test
  └─ Base  (contracts/tests/Base.sol)  — actors, constants, external token refs
       └─ Unit_Shared_Test  (shared/Shared.sol)  — abstract; setUp, deploy, helpers
            ├─ Unit_Concrete_<Contract>_<Feature>_Test  (concrete/*.t.sol)
            └─ Unit_Fuzz_<Contract>_<Feature>_Test      (fuzz/*.fuzz.t.sol)
```

- `Base` creates actors (`alice`, `bobby`, …, `governor`, `strategist`, etc.) and declares **all contract state variables** (OUSD, OUSDVault, OETH, OETHVault, proxies, mocks, external tokens). **Never declare contract variables in `Shared.sol`** — all contract/token storage lives in `Base.sol` so it is shared across all test suites.
- `Unit_Shared_Test` is **abstract** and owns all deployment + configuration logic. It assigns to the variables declared in `Base`, but does not re-declare them.
- Concrete and fuzz test contracts inherit `Unit_Shared_Test` directly — no extra layers.

## 3. Shared Test Contract (`shared/Shared.sol`)

The `setUp()` function follows this exact order:

```solidity
function setUp() public virtual override {
    super.setUp();                // Base actors
    vm.warp(7 days);              // Reasonable starting timestamp
    _deployMockContracts();       // MockERC20, MockNonRebasing, etc.
    _deployContracts();           // Implementations + proxies, cast to typed refs
    _configureContracts();        // Governor calls: unpause, set params
    _fundInitialUsers();          // Mint initial balances for a few actors
    label();                      // vm.label every contract
}
```

### Key rules

- Deploy **implementations** then **ERC1967 proxies**, initialize via `proxy.initialize(impl, governor, initData)`.
- Cast proxies to their interface types (`ousd = OUSD(address(ousdProxy))`).
- Configuration block uses `vm.startPrank(governor)` / `vm.stopPrank()`.
- Funding uses the shared `_mintOToken` helper (see below).
- `label()` at the bottom labels every deployed address for trace readability.

## 4. Concrete Test Naming

### Contract & file name

Each file tests **one function**. The file name and contract name use the function name in PascalCase:

```
File:     concrete/RebaseOptIn.t.sol
Contract: Unit_Concrete_<ContractName>_RebaseOptIn_Test
```

Since each file covers a single function, there is typically **one section** per file. Use the `//////` banner at the top:

```solidity
//////////////////////////////////////////////////////
/// --- FUNCTION_NAME
//////////////////////////////////////////////////////
```

If a function has many scenarios, you may add sub-sections (e.g. `/// --- FUNCTION_NAME — edge cases`), but **never** add a section for a different function — that belongs in its own file.

### Function naming

| Pattern | When |
|---|---|
| `test_<function>()` | Happy path, default scenario |
| `test_<function>_<behavior>()` | Specific scenario or property |
| `test_<function>_RevertWhen_<condition>()` | Expected revert |
| `test_<function>_emits<EventName>()` | Event emission check |

**CRITICAL — Casing rules:**
- `<function>`, `<behavior>`, and `<condition>` all use **camelCase** (lowercase first character).
- `RevertWhen` is the **only** PascalCase token — everything else after `test_` starts lowercase.
- `RevertWhen` always comes **after** the function name, never at the start.

**Correct examples:**
```
test_mint()                                    // ✅ function = mint
test_mint_toRebasingUser()                     // ✅ behavior = toRebasingUser
test_mint_RevertWhen_notVault()                // ✅ RevertWhen after function, condition = notVault
test_createCurvePoolBoosterPlain_storesEntry() // ✅ function + behavior, both camelCase
test_approveFactory_RevertWhen_zeroAddress()   // ✅
testFuzz_handleFee()                           // ✅ fuzz follows same rules
testFuzz_bribeSplit_sumsCorrectly()            // ✅
```

**Wrong examples (DO NOT USE):**
```
test_Mint()                                    // ❌ uppercase M
test_RevertWhen_Mint_NotVault()                // ❌ RevertWhen before function name
test_CreatePoolBooster_StoresEntry()           // ❌ uppercase C and S
test_RevertWhen_ApproveFactory_NotGovernor()   // ❌ RevertWhen before function name
testFuzz_HandleFee()                           // ❌ uppercase H
```

### Revert tests

- Always use `vm.expectRevert("exact message")` right before the call.
- Group reverts immediately after the happy-path tests for that function.
- Test unauthorized access: `RevertWhen_notGovernor`, `RevertWhen_notVault`, etc.

### Event tests

```solidity
vm.expectEmit(true, true, true, true);
emit ContractStorage.EventName(arg1, arg2);
contractCall();
```

### Prank usage

- `vm.prank(actor)` for single external calls.
- `vm.startPrank(actor)` / `vm.stopPrank()` when multiple calls are needed from the same actor.

## 5. Fuzz Test Naming

### Contract name

```
Unit_Fuzz_<ContractName>_<Feature>_Test
```

### Function naming

```solidity
/// @notice <english description of the property being tested>
function testFuzz_<function>_<property>(uint256 amount) public { ... }
```

Same casing rules as concrete tests: `<function>` and `<property>` use **camelCase** (lowercase first character). Example: `testFuzz_handleFee(uint256, uint16)`, not `testFuzz_HandleFee`.

### Input bounding

- **Always** use `bound()`, never `vm.assume()`.
- Common ranges:
  - USDC amounts: `bound(amount, 1, 1e12)`
  - OUSD amounts: `bound(amount, 1e12, 100e18)` (avoids sub-wei dust)
  - Basis points: `bound(bps, 1, 5000)`
  - Yield (small, under caps): `bound(yield_, 1, 3e5)`

### Assertions

- Use `assertEq` when the math is exact / multiplicative (e.g. `amount * 1e12`).
- Use `assertApproxEqAbs(actual, expected, tolerance)` where rounding occurs (rebasing, buffer division).
- Use `assertLe` / `assertGe` for inequality invariants (e.g. `claimed <= claimable <= queued`).

### Style

- 5-10 fuzz tests per file — focus on the strongest properties.
- Each test starts with a `/// @notice` describing the property in plain English.

## 6. Foundry Fuzz Config

The `[fuzz]` section in `contracts/foundry.toml`:

```toml
[fuzz]
runs = 1024
max_test_rejects = 65536
seed = "0x1"
dictionary_weight = 40
include_storage = true
include_push_bytes = true
```

Do not add per-test `/// forge-config` overrides unless explicitly requested.

## 7. Helper Conventions

Helpers go at the **bottom** of the file, in a `/// --- HELPERS` section.

### Common helpers (in `Shared.sol`)

| Helper | Purpose |
|---|---|
| `_dealUSDC(address, uint256)` | Mint mock USDC to an address |
| `_mintOUSD(address, uint256)` | Deal USDC + approve + vault.mint() |
| `_deployAndApproveStrategy()` | Deploy MockStrategy, configure withdrawAll, governor approve |
| `label()` | `vm.label` every deployed contract |

### Per-file helpers (in concrete/fuzz files)

| Helper | Purpose |
|---|---|
| `_injectYield(uint256 usdcAmount)` | Deal USDC to `address(this)`, transfer to vault (simulates yield) |
| `_toArray(address a)` / `_toArray(uint256 a)` | Build single-element memory arrays for strategy calls |
| `_snap(address user) returns (VaultSnapshot)` | Capture full vault + user state for before/after comparison |
| `_drainInitialOUSD()` | Withdraw all initial user balances to start from clean state |
| `_setupThreeUsersWithOUSD()` | Drain + fund daniel(10), josh(20), matt(30) |
| `_setupStrategyWith15USDC()` | Three users + strategy with 15 USDC deposited |
| `_setupInsolvencyScenario()` | Scenario for testing slashed strategies |

### Snapshot struct pattern

For complex state comparisons, define a struct and a `_snap` helper:

```solidity
struct VaultSnapshot {
    uint256 ousdTotalSupply;
    uint256 ousdTotalValue;
    uint256 vaultCheckBalance;
    uint256 userOusd;
    uint256 userUsdc;
    uint256 vaultUsdc;
    uint128 queued;
    uint128 claimable;
    uint128 claimed;
    uint128 nextWithdrawalIndex;
}

function _snap(address user) internal view returns (VaultSnapshot memory s) { ... }
```

Then use `before` / `after_` naming:

```solidity
VaultSnapshot memory before = _snap(alice);
// ... action ...
VaultSnapshot memory after_ = _snap(alice);
assertEq(after_.userOusd, before.userOusd - amount);
```

## 8. Run Commands

```bash
# Run all tests for a specific contract
forge test --match-path "tests/unit/vault/OUSDVault/**"

# Run a specific test contract
forge test --match-contract Unit_Concrete_OUSDVault_Mint_Test

# Run a single test
forge test --match-test test_mint_RevertWhen_amountIsZero

# Run with verbosity for traces
forge test --match-contract Unit_Concrete_OUSDVault_Mint_Test -vvvv
```

All commands must be run from the `contracts/` directory.

## 9. Coverage Requirements

After all tests compile and pass, you **must** verify coverage meets the minimum thresholds. If any metric is below 100%, try to add more tests to cover the gaps. 

### Minimum thresholds

| Metric | Minimum | Target |
|---|---|---|
| **Functions** | **100%** | 100% (mandatory — every function must be called) |
| **Branches** | **98%** |100% |
| **Lines** | **98%** |100% |
| **Statements** | **98%** |100% |

### How to check coverage

Run the following command from the `contracts/` directory, filtering to only the target contract:

```bash
forge coverage --match-path "tests/unit/<category>/<ContractName>/**" --report summary --no-match-coverage "tests|mocks"
```

This produces a table like:

```
| File                  | % Lines | % Statements | % Branches | % Funcs |
|-----------------------|---------|--------------|------------|---------|
| contracts/MyContract.sol | 95.00% | 93.50%     | 91.20%     | 100%    |
```

### Iterative coverage improvement

1. **Run coverage** after the initial test suite is written.
2. **Identify gaps**: look at which lines/branches are uncovered. Use `forge coverage --report lcov` and inspect the lcov output if needed to pinpoint exact uncovered lines.
3. **Add missing tests**: write additional concrete tests targeting the uncovered paths — edge cases, error branches, boundary conditions.
4. **Re-run coverage** to verify improvements. Repeat until thresholds are met.
5. **Always aim higher**: 90% is the floor, not the goal. Push for the highest coverage you can achieve.

### When 100% is not reachable

Some code paths may be genuinely unreachable in a unit-test context (e.g., assembly blocks, delegatecall-only paths, code guarded by external contract state that cannot be mocked). If any metric stays below 100%, you **must** explain why in a brief comment at the end of your response, listing:

- The exact uncovered lines/branches
- Why they cannot be covered in a unit test
- Whether an integration or fork test would be needed instead

## 10. Checklist Before Submitting Tests

- [ ] `shared/Shared.sol` is `abstract` and inherits `Base`
- [ ] All contract/proxy/token state variables are declared in `Base.sol`, not in `Shared.sol`
- [ ] `setUp()` follows the exact order: super → warp → mocks → contracts → config → fund → label
- [ ] **One file per function**: each state-changing function has its own `.t.sol` file (only views/setters may be grouped)
- [ ] Concrete contracts use `Unit_Concrete_<Contract>_<Function>_Test`
- [ ] Fuzz contracts use `Unit_Fuzz_<Contract>_<Function>_Test`
- [ ] Every fuzz test uses `bound()`, not `vm.assume()`
- [ ] Every fuzz test has a `/// @notice` property description
- [ ] Helpers are at the bottom of each file
- [ ] Section banners use `//////` style
- [ ] Tests compile: `forge build`
- [ ] Tests pass: `forge test --match-path "tests/unit/<category>/<ContractName>/**"`
- [ ] Coverage meets thresholds: Functions = 100%, Branches/Lines/Statements ≥ 90%
- [ ] If any metric is below 100%, an explanation is provided for the uncovered paths
