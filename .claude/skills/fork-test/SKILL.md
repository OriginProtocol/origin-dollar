---
description: Generate Foundry fork tests for contracts requiring integration testing against real on-chain state.
user_invocable: true
---

# Fork Test Skill

Generate Foundry fork tests for a specific contract, validating behavior against real on-chain state. Fork tests complement unit tests for paths that mocks cannot faithfully reproduce — AMO pool interactions, real router swaps, oracle reads, gauge rewards, and cross-chain flows. Follow the guidelines below to ensure consistency and maintainability across our fork test suite.

## 0. Check for Existing Hardhat Fork Tests First

**Before writing any Foundry fork test**, check if corresponding Hardhat fork tests already exist in `contracts/test/`. Fork tests follow the naming pattern `*.<chain>.fork-test.js`.

**How to find them:**
1. Search `contracts/test/<category>/` for files matching `*.<chain>.fork-test.js` (e.g. `contracts/test/strategies/sonic/swapx-amo.sonic.fork-test.js`)
2. Check `contracts/test/_fixture.js` and related fixture files for deployment/setup patterns on forked networks

**What to extract from Hardhat fork tests:**
- **Integration scenarios**: Multi-step flows that exercise real protocol interactions (deposit → swap → withdraw)
- **Real parameter values**: Actual on-chain addresses, pool parameters, slippage tolerances
- **Multi-step flows**: Sequences that reveal how the contract interacts with external protocols end-to-end
- **Expected behaviors on fork**: How the contract behaves with real pool liquidity, oracle prices, and gauge states
- **Whale addresses**: Accounts used for `deal`-ing tokens or impersonation

**Do NOT blindly copy Hardhat tests.** Adapt them to Foundry conventions (naming, structure, assertions). The Hardhat fork tests are a **starting point and inspiration**, not a ceiling.

## 1. Directory Layout

```
contracts/tests/fork/<category>/<ContractName>/
├── shared/
│   └── Shared.t.sol          # Abstract base with setUp, fork creation, deploy, helpers
└── concrete/
    ├── Deposit.t.sol          # One file per integration scenario
    ├── Withdraw.t.sol
    └── Rebalance.t.sol
```

**NEVER `fuzz/` directory** — fork tests are concrete only (RPC calls make fuzz runs prohibitively slow).

**Fewer files than unit tests**: Only create files for functions with meaningful integration behavior (pool interactions, swaps, bridge flows). Simple setters, view functions, and access control are covered by unit tests.

`<category>` matches the subdirectories already in `contracts/tests/fork/` (strategies, vault, token, etc.).

### One file per integration scenario

Each file tests one public/external function's interaction with real on-chain state. The file name uses PascalCase matching the function name (e.g. `deposit()` → `Deposit.t.sol`).

**Do NOT** create fork test files for:
- Functions already fully covered by unit tests with no external protocol dependency
- Simple setters, view functions, access control, constructor validation, pure math

## 2. Inheritance Chain

```
forge-std/Test
  └─ Base  (contracts/tests/Base.t.sol)  — actors, constants, fork IDs, contract refs
       └─ BaseFork  (contracts/tests/fork/BaseFork.t.sol)  — fork creation helpers
            └─ Fork_<Contract>_Shared_Test  (shared/Shared.t.sol)  — abstract; setUp, deploy, helpers
                 └─ Fork_Concrete_<Contract>_<Feature>_Test  (concrete/*.t.sol)
```

- `Base` creates actors (`alice`, `bobby`, …, `governor`, `strategist`, etc.) and declares constants, IERC20 external token refs, and fork IDs (`forkIdMainnet`, `forkIdBase`, `forkIdSonic`, `forkIdArbitrum`). **`Base` only contains actors, constants, IERC20 external tokens, fork IDs, and setUp().** All typed contract/proxy/mock state variables are declared in each `Shared.t.sol` file.
- `BaseFork` provides `_createAndSelectFork<Chain>()` helpers that read RPC URLs from environment variables and create Foundry forks.
- `Fork_<Contract>_Shared_Test` is **abstract** and owns all deployment + configuration logic on top of the fork.
- Concrete test contracts inherit `Fork_<Contract>_Shared_Test` directly — no extra layers.

### Interface-only testing

Tests must interact with contracts through **interfaces**, not concrete implementations. This applies to fork tests the same as unit tests — see `contracts/tests/README.md` for full details.

**Available interfaces:**

| Interface | File | Used for |
|-----------|------|----------|
| `IVault` | `contracts/interfaces/IVault.sol` | All vault contracts |
| `IOToken` | `contracts/interfaces/IOToken.sol` | All rebasing tokens (OUSD, OETH, OETHBase, OSonic) |
| `IWOToken` | `contracts/interfaces/IWOToken.sol` | All wrapped tokens |
| `IProxy` | `contracts/interfaces/IProxy.sol` | All proxy instances |
| Strategy interfaces | `contracts/interfaces/strategies/` | Per-strategy interfaces |

**Key rules:**
- Import interfaces, not concrete contracts: `import {IVault} from "contracts/interfaces/IVault.sol";`
- Declare state variables with interface types: `IVault internal oethVault;`
- Deploy fresh contracts with `vm.deployCode` instead of `new`, and **always reference artifact paths through `tests/utils/Artifacts.sol`** rather than inline string literals: `vm.deployCode(Vaults.OETH, abi.encode(address(weth)))`. If the artifact you need is not yet declared in `Artifacts.sol`, add it to the relevant sub-library (`Tokens`, `Vaults`, `Proxies`, `Strategies`, ...) first.
- Reference events from the interface: `emit IVault.CapitalPaused();`
- For forked contracts, cast the address to the interface: `oethVault = IVault(Mainnet.OETH_VAULT);`

### Product-specific vault types

Each product has its own vault contract. **Always use the correct vault type**:

| Product | Token | Vault | Chain | Artifacts reference |
|---------|-------|-------|-------|---------------------|
| OUSD | `OUSD` | `OUSDVault` | Mainnet | `Vaults.OUSD` |
| OETH | `OETH` | `OETHVault` | Mainnet | `Vaults.OETH` |
| OSonic | `OSonic` | **`OSVault`** | Sonic | `Vaults.OS` |
| OETHBase | `OETHBase` | `OETHBaseVault` | Base | `Vaults.OETH_BASE` |

Add the entry to `tests/utils/Artifacts.sol` if it does not exist yet.

`OSVault` lives at `contracts/vault/OSVault.sol`. **NEVER use `OETHVault` for Sonic products.**

## 3. Shared Test Contract (`shared/Shared.t.sol`)

The `setUp()` function follows this exact order:

```solidity
function setUp() public virtual override {
    super.setUp();                        // Base actors + BaseFork helpers
    _createAndSelectFork<Chain>();        // Create fork (e.g. _createAndSelectForkSonic())
    _deployFreshContracts();             // Deploy fresh contracts on top of fork
    _configureContracts();               // Governor calls: set params, approve strategies
    label();                             // vm.label every contract
}
```

### Fresh vs Fork decision guide

Decide **case-by-case** whether each contract should be deployed fresh or used from the fork:

| Decision | Examples | Rationale |
|----------|----------|-----------|
| **Always fresh** | Contract under test, OToken + Vault, pools/gauges the strategy directly manages | You need a clean, controlled state for the contract being tested |
| **Typically from fork** | Routers, factories, underlying tokens (WETH, USDC), oracles, price feeds | External infrastructure the strategy just calls — use real state |
| **Decision criteria** | If the strategy creates/manages/owns it → deploy fresh. If it's external infrastructure the strategy just calls → use from fork | Minimize setup complexity while ensuring test isolation |

### Accessing forked contract addresses

Use the address libraries from `tests/utils/Addresses.sol`:

```solidity
import {Mainnet} from "tests/utils/Addresses.sol";
import {Sonic} from "tests/utils/Addresses.sol";
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

// In setUp:
address weth = Mainnet.WETH;
address pool = Sonic.SwapXWSOS_pool;
```

### Key rules

- Deploy fresh **implementations** with `vm.deployCode`, then **proxies** with `vm.deployCode(Proxies.IG_PROXY)`. All artifact paths (including the proxy) come from `tests/utils/Artifacts.sol` — never inline a `"contracts/...sol:Name"` string in a test file.
- Initialize via `proxy.initialize(impl, governor, initData)`.
- Cast proxies to interface types: `oSonic = IOToken(address(oSonicProxy))`.
- Cast forked addresses to interfaces: `oethVault = IVault(Mainnet.OETH_VAULT)`.
- Configuration block uses `vm.startPrank(governor)` / `vm.stopPrank()`.
- `label()` at the bottom labels every deployed address **and** key forked addresses for trace readability.
- **Gotcha:** `vm.deployCode` loads from compiled artifacts. Always run `forge build contracts/` before `forge test` after modifying contract source.

## 4. Concrete Test Naming

### Contract & file name

Each file tests **one function's integration behavior**. The file name and contract name use the function name in PascalCase:

```
File:     concrete/Deposit.t.sol
Contract: Fork_Concrete_<ContractName>_Deposit_Test
```

Use the `//////` banner at the top:

```solidity
//////////////////////////////////////////////////////
/// --- FUNCTION_NAME
//////////////////////////////////////////////////////
```

### Function naming

| Pattern | When |
|---|---|
| `test_<function>()` | Happy path with real on-chain state |
| `test_<function>_<behavior>()` | Specific integration scenario |
| `test_<function>_RevertWhen_<condition>()` | Expected revert against real state |
| `test_<function>_emits<EventName>()` | Event emission check |

**CRITICAL — Casing rules:**
- `<function>`, `<behavior>`, and `<condition>` all use **camelCase** (lowercase first character).
- `RevertWhen` is the **only** PascalCase token — everything else after `test_` starts lowercase.
- `RevertWhen` always comes **after** the function name, never at the start.

**Correct examples:**
```
test_deposit()                                   // happy path
test_deposit_withLargeAmount()                   // specific scenario
test_withdraw_RevertWhen_insufficientLiquidity() // revert
test_rebalance_movesLiquidityToPool()            // behavior description
```

### Revert tests

- Always use `vm.expectRevert("exact message")` right before the call.
- Group reverts immediately after the happy-path tests for that function.

### Event tests

```solidity
vm.expectEmit(true, true, true, true);
emit IVault.EventName(arg1, arg2);  // Always reference events from the interface
contractCall();
```

### Prank usage

- `vm.prank(actor)` for single external calls.
- `vm.startPrank(actor)` / `vm.stopPrank()` when multiple calls are needed from the same actor.

## 5. What to Fork Test (and What NOT To)

### DO fork test

| Category | Examples |
|----------|----------|
| **AMO pool interactions** | Adding/removing liquidity from real Curve/Aerodrome/SwapX pools |
| **Real router swaps** | Swapping through actual DEX routers with real liquidity |
| **Oracle reads** | Reading from real Chainlink feeds, pool TWAPs |
| **Gauge rewards** | Claiming from real gauge contracts, reward distribution |
| **Cross-chain flows** | Bridge message encoding/decoding with real bridge contracts |
| **Vault rebase on fork** | Rebasing with real strategy balances and yield |
| **Zapper flows** | End-to-end zap with real token contracts |
| **Complex multi-step operations** | Deposit → rebalance → harvest → withdraw |

### DON'T fork test

**CRITICAL — The litmus test:** Before adding any test to a fork file, ask: *"Does this test exercise real on-chain state that a mock cannot faithfully reproduce?"* If the answer is no, it belongs in unit tests only. The fork RPC is expensive — every test that doesn't need it wastes CI time and adds noise.

| Category | Why | Covered by |
|----------|-----|------------|
| Simple setters | No external dependency | Unit tests |
| View functions (simple) | No state change against external protocols | Unit tests |
| Access control reverts | `msg.sender` check is identical on fork and in unit test | Unit tests |
| Constructor validation | Deployment-time checks | Unit tests |
| Pure math / internal helpers | No external calls | Unit tests (fuzz) |
| Input validation reverts | `require()` checks on arguments (zero amount, wrong asset, bad params) | Unit tests |

**Concrete examples of tests that do NOT belong in fork files:**
```
// ALL of these are unit-test-only — do NOT add to fork tests:
test_deposit_RevertWhen_amountIsZero()          // input validation
test_deposit_RevertWhen_unsupportedAsset()       // input validation
test_deposit_RevertWhen_calledByNonVault()       // access control
test_withdraw_RevertWhen_amountIsZero()          // input validation
test_withdraw_RevertWhen_unsupportedAsset()      // input validation
test_withdrawAll_RevertWhen_calledByNonVaultOrGovernor()  // access control
test_mintAndAddOTokens_RevertWhen_calledByNonStrategist() // access control
test_setMaxSlippage()                            // simple setter
test_setMaxSlippage_RevertWhen_tooHigh()         // input validation
test_checkBalance_RevertWhen_unsupportedAsset()  // input validation on view
```

**Contrast with revert tests that DO belong in fork tests:**
```
// These exercise real pool math / solvency checks against on-chain state:
test_deposit_RevertWhen_protocolInsolvent()      // solvency check uses real vault.totalValue()
test_mintAndAddOTokens_RevertWhen_overshoots()   // improvePoolBalance uses real pool balances
test_withdraw_RevertWhen_insufficientLPTokens()  // calcTokenToBurn uses real virtual_price
```

## 6. Chain-to-Product Mapping

| Contract/Product | Chain | Fork Method | Address Library |
|-----------------|-------|-------------|-----------------|
| OUSD / OUSDVault | Mainnet | `_createAndSelectForkMainnet()` | `Mainnet` |
| OETH / OETHVault | Mainnet | `_createAndSelectForkMainnet()` | `Mainnet` |
| CurveAMOStrategy (OETH) | Mainnet | `_createAndSelectForkMainnet()` | `Mainnet` |
| CurveAMOStrategy (OUSD) | Mainnet | `_createAndSelectForkMainnet()` | `Mainnet` |
| NativeStakingSSVStrategy | Mainnet | `_createAndSelectForkMainnet()` | `Mainnet` |
| OETHBase / OETHBaseVault | Base | `_createAndSelectForkBase()` | `Base` (aliased as `BaseAddresses`) |
| AerodromeAMOStrategy | Base | `_createAndSelectForkBase()` | `Base` (aliased as `BaseAddresses`) |
| BaseCurveAMOStrategy | Base | `_createAndSelectForkBase()` | `Base` (aliased as `BaseAddresses`) |
| BridgedWOETHStrategy | Base | `_createAndSelectForkBase()` | `Base` (aliased as `BaseAddresses`) |
| OSonic / OSVault | Sonic | `_createAndSelectForkSonic()` | `Sonic` |
| SonicStakingStrategy | Sonic | `_createAndSelectForkSonic()` | `Sonic` |
| SonicSwapXAMOStrategy | Sonic | `_createAndSelectForkSonic()` | `Sonic` |
| WOETH (Arbitrum) | Arbitrum | `_createAndSelectForkArbitrum()` | `ArbitrumOne` |

**IMPORTANT:** When importing the `Base` address library, alias it to avoid collision with the `Base` test contract:
```solidity
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";
```

### Environment variables for RPC

The fork helpers in `BaseFork.t.sol` read these env vars:

| Chain | RPC URL env var | Optional block number env var |
|-------|----------------|-------------------------------|
| Mainnet | `MAINNET_PROVIDER_URL` | `FORK_BLOCK_NUMBER_MAINNET` |
| Base | `BASE_PROVIDER_URL` | `FORK_BLOCK_NUMBER_BASE` |
| Sonic | `SONIC_PROVIDER_URL` | `FORK_BLOCK_NUMBER_SONIC` |
| Arbitrum | `ARBITRUM_PROVIDER_URL` | `FORK_BLOCK_NUMBER_ARBITRUM` |

Configure these in `foundry.toml` under `[rpc_endpoints]` or pass via environment.

## 7. Helper Conventions

Helpers go at the **bottom** of the file, in a `/// --- HELPERS` section.

### Common helpers (in `Shared.t.sol`)

| Helper | Purpose |
|---|---|
| `_dealToken(address token, address to, uint256 amount)` | Deal real ERC20 tokens to an address using `deal()` cheatcode |
| `_dealNative(address to, uint256 amount)` | Deal native ETH/S to an address using `vm.deal()` |
| `_depositToVault(address user, uint256 amount)` | Full deposit flow: deal token → approve → mint |
| `_depositToStrategy(uint256 amount)` | Governor deposits vault funds to strategy |
| `label()` | `vm.label` every deployed and forked contract |

### Per-file helpers (in concrete files)

| Helper | Purpose |
|---|---|
| `_addLiquidityToPool(uint256 amount)` | Add liquidity to the real pool being tested |
| `_simulateYield(uint256 amount)` | Simulate yield accrual in the forked state |
| `_swapOnPool(address tokenIn, address tokenOut, uint256 amount)` | Execute a swap on the real pool |
| `_snap(address user) returns (Snapshot)` | Capture state for before/after comparison |
| `_claimRewards()` | Trigger reward claim from real gauge |

### Snapshot struct pattern

For complex state comparisons, define a struct and a `_snap` helper:

```solidity
struct Snapshot {
    uint256 totalSupply;
    uint256 totalValue;
    uint256 strategyBalance;
    uint256 vaultBalance;
    uint256 userBalance;
    uint256 poolLiquidity;
}

function _snap(address user) internal view returns (Snapshot memory s) { ... }
```

Then use `before` / `after_` naming:

```solidity
Snapshot memory before = _snap(alice);
// ... action ...
Snapshot memory after_ = _snap(alice);
assertGe(after_.strategyBalance, before.strategyBalance);
```

## 8. Run Commands

```bash
# Run all fork tests for a specific contract
forge test --match-path "tests/fork/strategies/CurveAMOStrategy/**" --fork-url $MAINNET_PROVIDER_URL

# Run a specific fork test contract
forge test --match-contract Fork_Concrete_CurveAMOStrategy_Deposit_Test

# Run a single test
forge test --match-test test_deposit_withLargeAmount

# Run with verbosity for traces
forge test --match-contract Fork_Concrete_CurveAMOStrategy_Deposit_Test -vvvv

# Run with a pinned block number
FORK_BLOCK_NUMBER_MAINNET=19000000 forge test --match-path "tests/fork/strategies/CurveAMOStrategy/**"
```

All commands must be run from the `contracts/` directory.

**Note:** Fork tests require RPC provider URLs to be set. Either export them as environment variables or configure them in `foundry.toml` under `[rpc_endpoints]`.

## 9. Coverage Requirements

Fork tests are **not** expected to achieve coverage minimums on their own — they complement unit tests.

### Fork-only coverage

No minimum threshold. Fork tests target integration paths that unit tests cannot cover.

### Combined (unit + fork) coverage targets

| Metric | Minimum | Target |
|---|---|---|
| **Functions** | **100%** | 100% (mandatory — every function must be called) |
| **Branches** | **98%** | 100% |
| **Lines** | **98%** | 100% |
| **Statements** | **98%** | 100% |

### How to check combined coverage

**IMPORTANT: NEVER use `--ir-minimum` with `forge coverage`.** If `forge coverage` fails to compile without `--ir-minimum` (e.g., "stack too deep" errors), use `--skip` flags to exclude problematic contracts instead.

**Known problematic contract:** `AerodromeAMOStrategy` (`contracts/strategies/aerodrome/AerodromeAMOStrategy.sol`) causes "stack too deep" errors during coverage compilation. Skipping it with `--skip "*/strategies/aerodrome*"` should resolve the issue:

```bash
# Combined coverage for a contract (unit + fork)
forge coverage --match-path "tests/**/strategies/CurveAMOStrategy/**" --report summary --no-match-coverage "tests|mocks"

# If compilation fails, skip the problematic AerodromeAMOStrategy contract
forge coverage --match-path "tests/**/strategies/CurveAMOStrategy/**" --report summary --no-match-coverage "tests|mocks" --skip "*/strategies/aerodrome*"
```

### When fork tests add coverage

After writing fork tests, re-run coverage to see if previously uncovered integration paths are now hit. Document which paths required fork testing in a brief comment.

## 10. Checklist Before Submitting Tests

- [ ] Checked `contracts/test/` for existing Hardhat fork tests (`*.<chain>.fork-test.js`) and drew inspiration from them
- [ ] `shared/Shared.t.sol` is `abstract` and inherits `BaseFork`
- [ ] All typed contract/proxy/mock state variables are declared in `Shared.t.sol` using interface types (not in `Base.t.sol`)
- [ ] No concrete contract imports — only interfaces (`IVault`, `IOToken`, `IProxy`, strategy interfaces) and mocks
- [ ] Fresh deployments use `vm.deployCode`, not `new` (except mocks)
- [ ] All artifact paths are referenced through `tests/utils/Artifacts.sol` (e.g. `Vaults.OETH`, `Proxies.IG_PROXY`) — no inline `"contracts/...sol:Name"` strings
- [ ] Forked contracts cast to interfaces: `IVault(Mainnet.OETH_VAULT)`
- [ ] `setUp()` follows the exact order: super → fork creation → fresh deploy → configure → label
- [ ] Fresh vs fork decision is correct: contract under test is fresh, external infrastructure is from fork
- [ ] Address constants use the correct library from `tests/utils/Addresses.sol`
- [ ] Correct vault type is used for the product (OSVault for Sonic, OETHVault for OETH, etc.)
- [ ] Concrete contracts use `Fork_Concrete_<Contract>_<Function>_Test`
- [ ] No fuzz tests (fork tests are concrete only)
- [ ] No simple revert tests (access control, input validation, simple setters) — these belong in unit tests
- [ ] Every test exercises real on-chain state that mocks cannot faithfully reproduce
- [ ] Helpers are at the bottom of each file
- [ ] Section banners use `//////` style
- [ ] Tests compile: `forge build`
- [ ] Tests pass: `forge test --match-path "tests/fork/<category>/<ContractName>/**"`
- [ ] Only integration-worthy functions are fork tested (no simple setters, views, or access control)
