---
description: Generate Foundry smoke tests that validate deployment health using DeployManager/Resolver against real on-chain state with pending governance applied.
---

# Smoke Test Skill

Generate Foundry smoke tests that verify deployment health by bootstrapping the **actual deployed state** (including pending governance actions) via the DeployManager/Resolver pipeline. Smoke tests sit between fork tests and production monitoring — they prove that a deployment is sound before governance execution. Follow the guidelines below to ensure consistency across the smoke test suite.

## 0. How Smoke Tests Differ from Unit and Fork Tests

| Aspect | Unit Tests | Fork Tests | Smoke Tests |
|--------|-----------|------------|-------------|
| **State** | Fresh deploys with mocks | Fresh deploys on top of fork | Actual deployed state via Resolver |
| **Purpose** | Full coverage, fuzz tests | Test specific integration paths | Verify deployment health |
| **Contracts** | Deployed in `setUp` | Mix of fresh + forked | All resolved from DeployManager |
| **Actors** | `makeAddr("Governor")` | `makeAddr("Governor")` | `ousd.governor()` (from live contracts) |
| **Tokens** | `MockERC20.mint()` | `deal()` cheatcode | `deal()` cheatcode |
| **Fuzz tests** | Yes | No | No |
| **Base class** | `Base` | `BaseFork` | `BaseSmoke` (extends `BaseFork`) |

**Key insight:** Smoke tests answer *"Is this deployment safe to execute?"* — not *"Does this code work?"* (unit tests) or *"Does this integrate correctly?"* (fork tests).

## 1. Directory Layout

```
contracts/tests/smoke/<category>/<Product>/
├── shared/
│   └── Shared.t.sol          # Abstract base with setUp, contract resolution, helpers
└── concrete/
    ├── ViewFunctions.t.sol    # One file per feature area
    ├── Mint.t.sol
    ├── Redeem.t.sol
    ├── Transfer.t.sol
    ├── Rebasing.t.sol
    └── YieldDelegation.t.sol
```

**NEVER `fuzz/` directory** — smoke tests are concrete only (fork-based, same reason as fork tests).

**One file per feature area**, not per function. Group tests by what they verify. The feature groupings depend on the contract being tested:

- **OTokens (OUSD, OETH, OSonic):** ViewFunctions, Mint, Redeem, Transfer, Rebasing, YieldDelegation
- **Vaults:** Mint, Redeem, Rebase, Allocate, WithdrawalQueue
- **Strategies:** Deposit, Withdraw, Harvest, Rebalance

These are examples — adapt groupings to the contract's own domain concepts.

`<category>` matches subdirectories already in `contracts/tests/smoke/` (token, vault, strategies, etc.).

## 2. Inheritance Chain

```
forge-std/Test
  └─ Base  (contracts/tests/Base.t.sol)  — actors, constants, contract refs
       └─ BaseFork  (contracts/tests/fork/BaseFork.t.sol)  — fork creation helpers
            └─ BaseSmoke  (contracts/tests/smoke/BaseSmoke.t.sol)  — resolver, _igniteDeployManager()
                 └─ Smoke_<Product>_Shared_Test  (shared/Shared.t.sol)  — abstract; setUp, resolve, helpers
                      └─ Smoke_Concrete_<Product>_<Feature>_Test  (concrete/*.t.sol)
```

- `Base` creates actors (`alice`, `bobby`, …) and declares constants, IERC20 external token refs, and fork IDs. **`Base` only contains actors, constants, IERC20 external tokens, fork IDs, and setUp().** All typed contract/proxy state variables are declared in each `Shared.t.sol` file using interface types.
- `BaseFork` provides `_createAndSelectFork<Chain>()` helpers.
- `BaseSmoke` provides:
  - `resolver` — deterministic address: `Resolver(address(uint160(uint256(keccak256("Resolver")))))`
  - `deployManager` — `DeployManager` instance
  - `_igniteDeployManager()` — runs the full deployment pipeline: parses JSON, etches Resolver, replays scripts, simulates governance
- `Smoke_<Product>_Shared_Test` is **abstract** and owns contract resolution + helpers.

### Interface-only testing

Smoke tests follow the same interface-only pattern as unit and fork tests — see `contracts/tests/README.md` for full details.

**Available interfaces:**

| Interface | File | Used for |
|-----------|------|----------|
| `IVault` | `contracts/interfaces/IVault.sol` | All vault contracts |
| `IOToken` | `contracts/interfaces/IOToken.sol` | All rebasing tokens (OUSD, OETH, OETHBase, OSonic) |
| `IWOToken` | `contracts/interfaces/IWOToken.sol` | All wrapped tokens |
| `IProxy` | `contracts/interfaces/IProxy.sol` | All proxy instances |
| Strategy interfaces | `contracts/interfaces/strategies/` | Per-strategy interfaces |

**Key rules:**
- Declare state variables with interface types: `IVault internal ousdVault;`, `IOToken internal ousd;`
- Resolve contracts from Resolver and cast to interfaces: `ousd = IOToken(resolver.resolve("OUSD_PROXY"));`
- Reference events from the interface: `emit IVault.YieldDistribution(...);`
- Access struct return values by field name: `ousdVault.withdrawalQueueMetadata().claimable`

### Product-specific vault types

| Product | Token | Vault | Chain | Fork Method |
|---------|-------|-------|-------|-------------|
| OUSD | `OUSD` | `OUSDVault` | Mainnet | `_createAndSelectForkMainnet()` |
| OETH | `OETH` | `OETHVault` | Mainnet | `_createAndSelectForkMainnet()` |
| OSonic | `OSonic` | **`OSVault`** | Sonic | `_createAndSelectForkSonic()` |
| OETHBase | `OETHBase` | `OETHBaseVault` | Base | `_createAndSelectForkBase()` |

**NEVER use `OETHVault` for Sonic products.** `OSVault` lives at `contracts/vault/OSVault.sol`.

## 3. Shared Test Contract (`shared/Shared.t.sol`)

The `setUp()` function follows this exact order:

```solidity
function setUp() public virtual override {
    super.setUp();                    // Base actors + BaseFork + BaseSmoke
    _createAndSelectFork<Chain>();   // Create fork (e.g. _createAndSelectForkMainnet())
    _igniteDeployManager();          // Bootstrap deployment state via DeployManager
    _fetchContracts();               // Resolve contracts from Resolver
    _resolveActors();                // Read governor/strategist from live contracts
    _labelContracts();               // vm.label for traces
}
```

### Critical differences from fork tests

| Aspect | Fork Tests | Smoke Tests |
|--------|-----------|-------------|
| **Contract source** | `_deployFreshContracts()` | `resolver.resolve("NAME")` |
| **Actor source** | `makeAddr("Governor")` | `ousd.governor()` |
| **Token funding** | `deal()` or mock mint | `deal()` only (real tokens) |
| **Governance** | Manual `vm.prank(governor)` config | Already applied by DeployManager |

### Key rules

- **No fresh deploys** — everything comes from the Resolver or fork state.
- **Resolve contracts by name** using `resolver.resolve("OUSD_PROXY")`, `resolver.resolve("VAULT_PROXY")`, etc. **ALL** origin related contract addresses must come from the Resolver. **DO NOT** deploy new instances, use hardcoded addresses or fetch from Mainnet/Base/Sonic Addresses.sol book. In case one address is missing from the Resolver, add it to the deployment pipeline and re-run the smoke test. In case you don't have the address at all, ask the team for help.
- **Cast resolved addresses to interfaces** — `ousd = IOToken(resolver.resolve("OUSD_PROXY"))`, not concrete types.
- **Resolve actors from contracts** — `governor = ousd.governor()`, `strategist = ousdVault.strategistAddr()`. Never use `makeAddr()` for governance actors.
- **Sanity-check the Resolver** in `_fetchContracts()`:
  ```solidity
  require(address(resolver).code.length > 0, "Resolver not initialized on fork");
  ```

### Example `_fetchContracts` and `_resolveActors`

```solidity
function _fetchContracts() internal virtual {
    require(address(resolver).code.length > 0, "Resolver not initialized on fork");
    ousd = IOToken(resolver.resolve("OUSD_PROXY"));
    ousdVault = IVault(payable(resolver.resolve("VAULT_PROXY")));
    usdc = IERC20(Mainnet.USDC);
}

function _resolveActors() internal virtual {
    governor = ousd.governor();
    strategist = ousdVault.strategistAddr();
}
```

## 4. Concrete Test Naming

### Contract & file name

Each file tests **one feature area**. The file name uses the feature in PascalCase:

```
File:     concrete/Mint.t.sol
Contract: Smoke_Concrete_<Product>_Mint_Test
```

Use the `//////` banner at the top:

```solidity
//////////////////////////////////////////////////////
/// --- FEATURE_NAME
//////////////////////////////////////////////////////
```

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
test_mint_producesOUSD()                          // ✅
test_mint_increasesTotalSupply()                  // ✅
test_requestWithdrawal_and_claim()                // ✅
test_mint_supplyInvariant()                       // ✅
```

### Prank usage

- `vm.prank(actor)` for single external calls.
- `vm.startPrank(actor)` / `vm.stopPrank()` when multiple calls are needed from the same actor.

## 5. What to Smoke Test (and What NOT To)

### DO smoke test

| Category | Examples |
|----------|----------|
| **Core operations** | Mint, redeem, transfer with real deployed contracts |
| **Supply invariants** | `rebasingSupply + nonRebasingSupply ≈ totalSupply` after operations |
| **Rebase correctness** | Yield distribution, credits-per-token updates |
| **Yield delegation** | Delegate/undelegate with real state |
| **View function sanity** | `totalSupply > 0`, `totalValue > 0`, governor is non-zero |
| **Withdrawal queue** | Request → ensure liquidity → claim flow |

### DON'T smoke test

| Category | Why | Covered by |
|----------|-----|------------|
| Access control | Same as unit tests — no deployment state needed | Unit tests |
| Input validation | Revert strings are code, not deployment state | Unit tests |
| Edge cases / fuzz | Too slow on fork, not deployment-relevant | Unit tests |
| Strategy internals | Smoke tests verify deployment, not strategy math | Fork tests |

**NEVER write `RevertWhen` tests in smoke tests.** All `test_*_RevertWhen_*` patterns (e.g. `RevertWhen_notVault`, `RevertWhen_unsupportedAsset`, `RevertWhen_zeroAmount`, `RevertWhen_notHarvester`) are access control or input validation — they test code behavior, not deployment health. They belong exclusively in unit tests.

## 6. Smoke Test Patterns

### `deal()` for real tokens

Never use `MockERC20.mint()` — tokens on fork are real. Use Foundry's `deal()` cheatcode:

```solidity
deal(address(usdc), alice, 1000e6);
```

### Additive deal for yield

When simulating yield, add to the existing balance — do not overwrite:

```solidity
deal(address(usdc), address(ousdVault), usdc.balanceOf(address(ousdVault)) + yieldUSDC);
```

### Vault liquidity management

On mainnet fork, most tokens are deployed in strategies. The withdrawal queue may be underfunded. Use a helper to ensure liquidity before claiming:

```solidity
function _ensureVaultLiquidity(uint256 extraUSDC) internal {
    (uint256 queued, uint256 claimable,,) = ousdVault.withdrawalQueueMetadata();
    uint256 shortfall = queued > claimable ? queued - claimable : 0;
    uint256 needed = shortfall + extraUSDC;
    uint256 currentBalance = usdc.balanceOf(address(ousdVault));
    if (needed > currentBalance) {
        deal(address(usdc), address(ousdVault), needed);
    }
    ousdVault.addWithdrawalQueueLiquidity();
}
```

### Tolerant assertions

Live state has rounding from prior operations. Use `assertApproxEqRel` or `assertApproxEqAbs` instead of strict `assertEq`:

```solidity
// Supply invariant with 0.01% tolerance
assertApproxEqRel(calculatedSupply, ousd.totalSupply(), 1e14);

// Mint produces approximately the expected amount (within 1 OUSD)
assertApproxEqAbs(balanceAfter - balanceBefore, 1000e18, 1e18);
```

### Rebase during mint

The vault may trigger a rebase during mint, so `totalSupply` may increase by more than the minted amount. Use `assertGe` for total supply checks:

```solidity
// totalSupply increases by at least the minted amount (may be more due to rebase)
assertGe(totalSupplyAfter - totalSupplyBefore, 1000e18 - 1e18);
```

### Supply invariant helper

Define a reusable helper to verify the fundamental supply invariant:

```solidity
function _assertSupplyInvariant() internal view {
    uint256 calculatedSupply = (ousd.rebasingCreditsHighres() * 1e18)
        / ousd.rebasingCreditsPerTokenHighres()
        + ousd.nonRebasingSupply();
    assertApproxEqRel(calculatedSupply, ousd.totalSupply(), 1e14);
}
```

## 7. Helper Conventions

Helpers go at the **bottom** of the file, in a `/// --- HELPERS` section.

### Common helpers (in `Shared.t.sol`)

| Helper | Purpose |
|---|---|
| `_fetchContracts()` | Resolve all contracts from the Resolver |
| `_resolveActors()` | Read governor/strategist from live contracts |
| `_labelContracts()` | `vm.label` every resolved contract |
| `_mintOToken(address, uint256)` | Deal underlying + approve + vault.mint() |
| `_rebase(uint256 yieldAmount)` | Additive deal to vault + warp + rebase |
| `_ensureVaultLiquidity(uint256)` | Ensure vault has enough to cover withdrawal queue |
| `_assertSupplyInvariant()` | Verify rebasingSupply + nonRebasingSupply ≈ totalSupply |

### Per-file helpers (in concrete files)

Keep file-specific helpers minimal. Most shared logic belongs in `Shared.t.sol`.

## 8. Run Commands

```bash
# Run all smoke tests for a product
forge test --match-path "tests/smoke/token/OUSD/**"

# Run a specific smoke test contract
forge test --match-contract Smoke_Concrete_OUSD_Mint_Test

# Run a single test
forge test --match-test test_mint_producesOUSD

# Run with verbosity for traces
forge test --match-contract Smoke_Concrete_OUSD_Mint_Test -vvvv
```

All commands must be run from the `contracts/` directory.

**Note:** Smoke tests require RPC provider URLs and a valid DeployManager configuration. Ensure the relevant chain's RPC URL is set (e.g. `MAINNET_PROVIDER_URL`).

## 9. Coverage Requirements

Smoke tests are **not** expected to achieve coverage minimums — they validate deployment health, not code paths.

Coverage is the domain of unit tests (and to a lesser extent, fork tests). Do not add smoke tests to improve coverage metrics.

## 10. Checklist Before Submitting Tests

- [ ] `shared/Shared.t.sol` is `abstract` and inherits `BaseSmoke`
- [ ] All typed contract/proxy state variables are declared in `Shared.t.sol` using interface types (not in `Base.t.sol`)
- [ ] No concrete contract imports — only interfaces (`IVault`, `IOToken`, `IProxy`, etc.)
- [ ] `setUp()` follows the exact order: super → fork creation → `_igniteDeployManager()` → fetch contracts → resolve actors → label
- [ ] Contracts are resolved via `resolver.resolve("NAME")` and cast to interfaces, not deployed fresh
- [ ] Actors are resolved from live contracts (`ousd.governor()`), not `makeAddr()`
- [ ] `deal()` is used for token funding, not mock minting
- [ ] Yield simulation uses additive deal (`currentBalance + yield`), not absolute
- [ ] Vault liquidity is ensured before withdrawal claims (`_ensureVaultLiquidity`)
- [ ] Assertions use tolerant comparisons (`assertApproxEqRel`, `assertApproxEqAbs`) where rounding exists
- [ ] Supply invariant is checked after state-changing operations
- [ ] One file per feature area (not per function)
- [ ] Concrete contracts use `Smoke_Concrete_<Product>_<Feature>_Test`
- [ ] No fuzz tests
- [ ] Section banners use `//////` style
- [ ] Tests compile: `forge build`
- [ ] Tests pass: `forge test --match-path "tests/smoke/<category>/<Product>/**"`
