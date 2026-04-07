---
description: Generate Foundry unit tests (concrete + fuzz) for a contract following our established conventions and patterns.
---

# Unit Test Skill

Generate Foundry unit tests for a specific contract, adhering to our established directory structure, naming conventions, and best practices. The tests should include both concrete scenarios and property-based fuzz tests, with clear organization and comprehensive coverage. Follow the guidelines below to ensure consistency and maintainability across our test suite.

## 0. Check for Existing Hardhat Tests First

**Before writing any Foundry test**, check if corresponding Hardhat tests already exist in `contracts/test/`. The Hardhat tests are organized by category (e.g. `contracts/test/strategies/`, `contracts/test/vault/`, `contracts/test/token/`).

**How to find them:**
1. Search `contracts/test/<category>/` for files matching the contract name or feature (e.g. `contracts/test/strategies/*crosschain*`, `contracts/test/strategies/*curve*`)
2. Also check for fork tests: files ending in `.mainnet.fork-test.js`, `.base.fork-test.js`, `.sonic.fork-test.js`
3. Look at `contracts/test/_fixture.js` and related fixture files for deployment/setup patterns

**What to extract from Hardhat tests:**
- **Test scenarios and edge cases**: The Hardhat tests document which scenarios the team considers important. Port all of them.
- **Expected revert messages**: Copy the exact revert strings used in `expect(...).to.be.revertedWith("...")`.
- **Setup patterns**: How the contract is deployed, configured, and what fixtures are used. Mirror this in the Foundry `Shared.t.sol`.
- **Numeric values and boundaries**: Specific amounts, thresholds, and edge-case values used in assertions.
- **Business logic flows**: Multi-step operations (e.g. deposit → bridge → confirm) that reveal how the contract is meant to be used.
- **Access control tests**: Which roles are tested and which functions they can/cannot call.

**Do NOT blindly copy Hardhat tests.** Adapt them to Foundry conventions (naming, structure, assertions). Add fuzz tests for properties that Hardhat tests only check with fixed values. The Hardhat tests are a **starting point and inspiration**, not a ceiling — always aim for higher coverage.

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

- `Base` creates actors (`alice`, `bobby`, …, `governor`, `strategist`, etc.) and declares constants, external token refs (`IERC20 usdc`, `IERC20 weth`), fork IDs, and `setUp()`. **`Base` only contains actors, constants, IERC20 external tokens, fork IDs, and setUp().** All typed contract/proxy/mock state variables are declared in each `Shared.t.sol` file. This keeps `Base` lightweight so changes to it don't invalidate the entire Forge cache.

### Interface-only testing

Tests must interact with contracts through **interfaces**, not concrete implementations. This is critical for Forge cache efficiency — see `contracts/tests/README.md` for full details.

**Available interfaces:**

| Interface | File | Used for |
|-----------|------|----------|
| `IVault` | `contracts/interfaces/IVault.sol` | All vault contracts |
| `IOToken` | `contracts/interfaces/IOToken.sol` | All rebasing tokens (OUSD, OETH, OETHBase, OSonic) |
| `IWOToken` | `contracts/interfaces/IWOToken.sol` | All wrapped tokens (WOETH, WOETHBase, WOETHPlume, WOSonic, WrappedOusd) |
| `IProxy` | `contracts/interfaces/IProxy.sol` | All proxy instances |

**Key rules:**
- Import interfaces, not concrete contracts: `import {IVault} from "contracts/interfaces/IVault.sol";`
- Declare state variables with interface types: `IVault internal ousdVault;`
- Deploy with `vm.deployCode` instead of `new`: `vm.deployCode("contracts/vault/OUSDVault.sol:OUSDVault", abi.encode(address(usdc)))`
- Reference events from the interface: `emit IVault.CapitalPaused();`
- Access struct return values by field name: `ousdVault.withdrawalQueueMetadata().claimable`

### Product-specific vault types

Each product has its own vault contract. **Always use the correct vault type** — do not substitute one product's vault for another:

| Product | Token | Vault source | `vm.deployCode` path |
|---------|-------|-------------|----------------------|
| OUSD | `OUSD` | `OUSDVault` | `contracts/vault/OUSDVault.sol:OUSDVault` |
| OETH | `OETH` | `OETHVault` | `contracts/vault/OETHVault.sol:OETHVault` |
| OSonic | `OSonic` | **`OSVault`** | `contracts/vault/OSVault.sol:OSVault` |
| OETHBase | `OETHBase` | `OETHBaseVault` | `contracts/vault/OETHBaseVault.sol:OETHBaseVault` |

`OSVault` lives at `contracts/vault/OSVault.sol`. Never use `OETHVault` for Sonic products.
- `Unit_Shared_Test` is **abstract** and owns all deployment + configuration logic.
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

- Deploy **implementations** with `vm.deployCode`, then **proxies** with `vm.deployCode("contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:InitializeGovernedUpgradeabilityProxy")`.
- Initialize via `proxy.initialize(impl, governor, initData)`.
- Cast proxies to their interface types (`ousd = IOToken(address(ousdProxy))`).
- Configuration block uses `vm.startPrank(governor)` / `vm.stopPrank()`.
- Funding uses the shared `_mintOToken` helper (see below).
- `label()` at the bottom labels every deployed address for trace readability.
- **Gotcha:** Because `vm.deployCode` loads from compiled artifacts and the contract source is not in the test's dependency tree, `forge test` alone will **not** recompile modified contracts. Always run `forge build contracts/` before `forge test` after modifying contract source.

## 3b. Mock Contracts

- **Test-only mocks** (e.g. `MockSwapXPair`, `MockSwapXGauge`, `MockWrappedSonic`) go in `tests/mocks/`.
- **Production mocks** (e.g. `MockSFC`, `MockStrategy`) that already exist under `contracts/mocks/` stay there — enhance them in-place if needed.
- Mock state variables are declared in `Base.t.sol` like all other contracts.

### Common mock pitfalls

| Pitfall | Wrong | Correct |
|---------|-------|---------|
| Sending native ETH/S | `payable(to).transfer(amount)` (2300 gas limit — fails if receiver has storage reads in `receive()`) | `(bool ok,) = payable(to).call{value: amount}("");` |
| Setting ERC20 balances | `deal(token, to, amount)` for wrapped tokens (sets balance slot but **not** `totalSupply` — causes `_burn` underflow) | Deposit via the actual `deposit()` flow when `_burn`/`withdraw` will be called later |
| Pool reserve helpers | Minting more tokens each call (accumulates) | Make helpers **idempotent**: check current balance, mint/burn only the difference |

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
emit IVault.EventName(arg1, arg2);  // Always reference events from the interface
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

**IMPORTANT: NEVER use `--ir-minimum` with `forge coverage`.** The `--ir-minimum` flag causes `require()` revert branches to not be tracked (the revert rolls back coverage instrumentation), producing misleading branch coverage numbers. If `forge coverage` fails to compile without `--ir-minimum` (e.g., "stack too deep" errors from other project contracts), do NOT add `--ir-minimum` as a workaround. Instead, use `--skip` flags to exclude the problematic contracts.

**Known problematic contract:** `AerodromeAMOStrategy` (`contracts/strategies/aerodrome/AerodromeAMOStrategy.sol`) causes "stack too deep" errors during coverage compilation. Skipping it with `--skip "*/strategies/aerodrome*"` should resolve the issue:

```bash
forge coverage --match-path "tests/unit/<category>/<ContractName>/**" --report summary --no-match-coverage "tests|mocks" --skip "*/strategies/aerodrome*"
```

If it compiles without `--skip`, use the simpler command:

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

- [ ] Checked `contracts/test/` for existing Hardhat tests and drew inspiration from them
- [ ] `shared/Shared.sol` is `abstract` and inherits `Base`
- [ ] All typed contract/proxy/mock state variables are declared in `Shared.sol` using interface types (not in `Base.sol`)
- [ ] No concrete contract imports — only interfaces (`IVault`, `IOToken`, `IWOToken`, `IProxy`) and mocks
- [ ] All deployments use `vm.deployCode`, not `new` (except mocks which are fine to use `new`)
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
