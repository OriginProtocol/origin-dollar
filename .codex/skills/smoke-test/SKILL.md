---
name: smoke-test
description: Generate Foundry smoke tests that validate deployment health using DeployManager/Resolver against real on-chain state with pending governance applied. Use when the user asks for smoke tests, deployment verification tests, or post-deploy health checks.
---

# Smoke Test

Generate Foundry smoke tests that verify deployment health by bootstrapping the actual deployed state (including pending governance) via the DeployManager/Resolver pipeline.

## 0. How smoke tests differ

| Aspect | Unit Tests | Fork Tests | Smoke Tests |
|--------|-----------|------------|-------------|
| State | Fresh deploys with mocks | Fresh deploys on fork | Actual deployed state via Resolver |
| Purpose | Full coverage, fuzz | Integration paths | Verify deployment health |
| Contracts | Deployed in setUp | Mix fresh + forked | All resolved from DeployManager |
| Actors | `makeAddr("Governor")` | `makeAddr("Governor")` | `ousd.governor()` (live) |
| Tokens | `MockERC20.mint()` | `deal()` | `deal()` |
| Fuzz | Yes | No | No |

Smoke tests answer "Is this deployment safe to execute?" — not "Does this code work?"

## 1. Directory layout

```text
contracts/tests/smoke/<category>/<Product>/
├── shared/
│   └── Shared.t.sol
└── concrete/
    ├── ViewFunctions.t.sol
    ├── Mint.t.sol
    ├── Redeem.t.sol
    └── Transfer.t.sol
```

Rules:

- smoke tests are concrete only; no `fuzz/` directory
- one file per **feature area**, not per function
- feature groupings depend on the contract being tested (e.g. for OTokens: ViewFunctions, Mint, Redeem, Transfer, Rebasing, YieldDelegation)

## 2. Inheritance chain

```text
forge-std/Test
  └─ Base
       └─ BaseFork
            └─ BaseSmoke
                 └─ Smoke_<Product>_Shared_Test
                      └─ Smoke_Concrete_<Product>_<Feature>_Test
```

`Base` owns shared actors, constants, IERC20 external token refs, and fork IDs. All typed contract/proxy state variables are declared in each `Shared.t.sol` using interface types.

`BaseSmoke` provides:

- `resolver` — deterministic address: `Resolver(address(uint160(uint256(keccak256("Resolver")))))`
- `_igniteDeployManager()` — runs the full deployment pipeline: parse JSON, etch Resolver, replay scripts, simulate governance

### Interface-only testing

Same rules as unit and fork tests — use interfaces, not concrete contracts:

- Declare state variables with interface types: `IVault internal ousdVault;`
- Resolve and cast to interfaces: `ousd = IOToken(resolver.resolve("OUSD_PROXY"));`
- Reference events from interfaces: `emit IVault.YieldDistribution(...);`
- Available interfaces: `IVault`, `IOToken`, `IWOToken`, `IProxy`, plus strategy interfaces in `contracts/interfaces/strategies/`

### Product-specific vault types

| Product | Token | Vault | Chain |
|---------|-------|-------|-------|
| OUSD | `OUSD` | `OUSDVault` | Mainnet |
| OETH | `OETH` | `OETHVault` | Mainnet |
| OSonic | `OSonic` | `OSVault` | Sonic |
| OETHBase | `OETHBase` | `OETHBaseVault` | Base |

Never use `OETHVault` for Sonic tests.

## 3. Shared setup contract

`shared/Shared.t.sol` should keep setup in this order:

```solidity
function setUp() public virtual override {
    super.setUp();
    _createAndSelectFork<Chain>();
    _igniteDeployManager();
    _fetchContracts();
    _resolveActors();
    _labelContracts();
}
```

Critical rules:

- no fresh deploys — everything comes from the Resolver or fork state
- resolve contracts by name and cast to interfaces: `ousd = IOToken(resolver.resolve("OUSD_PROXY"))`
- resolve actors from live contracts: `governor = ousd.governor()`
- sanity-check the Resolver: `require(address(resolver).code.length > 0, "Resolver not initialized")`

## 4. Concrete test naming

File and contract naming:

```text
concrete/Mint.t.sol
Smoke_Concrete_<Product>_Mint_Test
```

Function naming patterns:

- `test_<function>()`
- `test_<function>_<behavior>()`
- `test_<function>_RevertWhen_<condition>()`
- `test_<function>_emits<EventName>()`

Casing rules:

- function, behavior, and condition stay `camelCase`
- `RevertWhen` is the only PascalCase token in the test name

## 5. What belongs in smoke tests

Smoke-test these:

- core operations (mint, redeem, transfer) against deployed contracts
- supply invariants (`rebasingSupply + nonRebasingSupply ≈ totalSupply`)
- rebase correctness and yield distribution
- yield delegation with real state
- view function sanity (totalSupply > 0, governor is non-zero)
- withdrawal queue end-to-end (request → ensure liquidity → claim)

Do not smoke-test:

- access control (unit tests)
- input validation (unit tests)
- edge cases and fuzz properties (unit tests)
- strategy internals (fork tests)

## 6. Key patterns

### `deal()` for real tokens

Use `deal()`, not mock minting. Tokens on fork are real.

### Additive deal for yield

Add to the existing balance; do not overwrite:

```solidity
deal(address(usdc), address(vault), usdc.balanceOf(address(vault)) + yieldAmount);
```

### Vault liquidity management

On mainnet fork, most tokens sit in strategies. Ensure vault liquidity before claiming withdrawals:

```solidity
function _ensureVaultLiquidity(uint256 extra) internal {
    (uint256 queued, uint256 claimable,,) = vault.withdrawalQueueMetadata();
    uint256 shortfall = queued > claimable ? queued - claimable : 0;
    uint256 needed = shortfall + extra;
    if (needed > token.balanceOf(address(vault))) {
        deal(address(token), address(vault), needed);
    }
    vault.addWithdrawalQueueLiquidity();
}
```

### Tolerant assertions

Live state has rounding. Use approximate comparisons:

```solidity
assertApproxEqRel(calculatedSupply, ousd.totalSupply(), 1e14); // 0.01%
assertApproxEqAbs(balanceAfter - balanceBefore, expected, 1e18);
```

### Rebase during mint

The vault may trigger rebase during mint. Use `assertGe` for total supply changes:

```solidity
assertGe(totalSupplyAfter - totalSupplyBefore, mintedAmount - 1e18);
```

## Output expectations

When implementing smoke tests:

- keep tests focused on deployment health verification
- use tolerant assertions throughout — live state has accumulated rounding
- use interface-only imports; no concrete contract imports
- cast resolved addresses to interfaces, not concrete types
- mirror the existing OUSD smoke test structure before introducing new patterns
- prefer a few strong invariant checks over broad but shallow coverage
