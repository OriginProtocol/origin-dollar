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

### Revert tests

- Always use `vm.expectRevert("exact message")` right before the call.
- Group reverts immediately after the happy-path tests for that function.
- Test unauthorized access: `RevertWhen_unauthorized`, `RevertWhen_notGovernor`, etc.

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

## 9. Checklist Before Submitting Tests

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
