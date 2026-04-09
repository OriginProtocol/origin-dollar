---
name: unit-test
description: Generate Foundry unit tests for a contract using this repository's conventions, structure, and naming. Use when the user asks for unit tests, Foundry tests, concrete tests, fuzz tests, or to port Hardhat tests into Foundry unit tests.
---

# Unit Test

Generate Foundry unit tests for a specific contract following this repository's established directory layout, inheritance chain, setup order, and test naming rules.

## 0. Check for existing Hardhat tests first

Before writing a Foundry unit test, inspect `contracts/test/` for related Hardhat tests.

Look for:

- matching contract or feature files under `contracts/test/<category>/`
- fork files such as `*.mainnet.fork-test.js`, `*.base.fork-test.js`, `*.sonic.fork-test.js`
- fixture patterns in `contracts/test/_fixture.js` and related helpers

Extract:

- scenario coverage and edge cases
- exact revert messages
- deployment and fixture patterns
- important numeric bounds and thresholds
- access control expectations

Adapt them to Foundry conventions; do not copy them mechanically.

## 1. Directory layout

```text
contracts/tests/unit/<category>/<ContractName>/
├── shared/
│   └── Shared.sol
├── concrete/
│   ├── FunctionA.t.sol
│   ├── FunctionB.t.sol
│   └── ViewFunctions.t.sol
└── fuzz/
    ├── FunctionA.fuzz.t.sol
    └── FunctionB.fuzz.t.sol
```

Rules:

- one file per public or external state-changing function
- view and pure functions may be grouped in `ViewFunctions.t.sol`
- admin and setter functions may be grouped in `Admin.t.sol` or `Config.t.sol`

## 2. Inheritance chain

```text
forge-std/Test
  └─ Base
       └─ Unit_Shared_Test
            ├─ Unit_Concrete_<Contract>_<Feature>_Test
            └─ Unit_Fuzz_<Contract>_<Feature>_Test
```

`Base` owns shared actors, constants, and IERC20 external token refs. All typed contract/proxy/mock state variables are declared in each `Shared.t.sol` file (not in `Base`). This keeps `Base` lightweight so changes don't invalidate the entire Forge cache.

### Interface-only testing

Tests must interact with contracts through **interfaces**, not concrete implementations. See `contracts/tests/README.md` for full details.

Available interfaces:

| Interface | File | Used for |
|-----------|------|----------|
| `IVault` | `contracts/interfaces/IVault.sol` | All vault contracts |
| `IOToken` | `contracts/interfaces/IOToken.sol` | All rebasing tokens (OUSD, OETH, OETHBase, OSonic) |
| `IWOToken` | `contracts/interfaces/IWOToken.sol` | All wrapped tokens (WOETH, WOETHBase, WOETHPlume, WOSonic, WrappedOusd) |
| `IProxy` | `contracts/interfaces/IProxy.sol` | All proxy instances |
| Strategy interfaces | `contracts/interfaces/strategies/` | Per-strategy interfaces (ICurveAMOStrategy, ISonicStakingStrategy, etc.) |

Key rules:

- import interfaces, not concrete contracts
- declare state variables with interface types
- deploy with `vm.deployCode` instead of `new` (except mocks), and always reference artifact paths through `tests/utils/Artifacts.sol` (e.g. `vm.deployCode(Vaults.OUSD, abi.encode(address(usdc)))`); add the entry to the relevant sub-library if it does not exist yet
- reference events from the interface: `emit IVault.CapitalPaused();`
- access struct return values by field name: `vault.withdrawalQueueMetadata().claimable`

### Product-specific vault types

| Product | Token | Vault | Artifacts reference |
|---------|-------|-------|---------------------|
| OUSD | `OUSD` | `OUSDVault` | `Vaults.OUSD` |
| OETH | `OETH` | `OETHVault` | `Vaults.OETH` |
| OSonic | `OSonic` | `OSVault` | `Vaults.OS` |
| OETHBase | `OETHBase` | `OETHBaseVault` | `Vaults.OETH_BASE` |

Add the entry to `tests/utils/Artifacts.sol` if it does not exist yet.

Never use `OETHVault` for Sonic tests.

## 3. Shared setup contract

`shared/Shared.sol` should keep setup in this order:

```solidity
function setUp() public virtual override {
    super.setUp();
    vm.warp(7 days);
    _deployMockContracts();
    _deployContracts();
    _configureContracts();
    _fundInitialUsers();
    label();
}
```

Key rules:

- deploy implementations with `vm.deployCode`, then proxies with `vm.deployCode(Proxies.IG_PROXY)`; all artifact paths (including the proxy) come from `tests/utils/Artifacts.sol` — never inline a `"contracts/...sol:Name"` string in a test file
- initialize proxies via `proxy.initialize(impl, governor, initData)`
- cast proxies to interface types: `ousd = IOToken(address(ousdProxy))`
- use `vm.startPrank(governor)` for config blocks
- put labels at the end
- **gotcha**: `vm.deployCode` loads from compiled artifacts; always run `forge build contracts/` before `forge test` after modifying contract source

Mocks:

- test-only mocks belong under `tests/mocks/`
- existing production mocks under `contracts/mocks/` should usually be extended in place

## 4. Concrete test naming

File and contract naming:

```text
concrete/RebaseOptIn.t.sol
Unit_Concrete_<ContractName>_RebaseOptIn_Test
```

Function naming patterns:

- `test_<function>()`
- `test_<function>_<behavior>()`
- `test_<function>_RevertWhen_<condition>()`
- `test_<function>_emits<EventName>()`

Casing rules:

- function, behavior, and condition stay `camelCase`
- `RevertWhen` is the only PascalCase token in the test name

Use exact revert strings with `vm.expectRevert("...")`.

Emit events from interfaces, not concrete contracts:

```solidity
vm.expectEmit(true, true, true, true);
emit IVault.EventName(arg1, arg2);
```

## 5. Fuzz tests

Contract name pattern:

```text
Unit_Fuzz_<ContractName>_<Feature>_Test
```

Function pattern:

```solidity
/// @notice Plain-English property description
function testFuzz_<function>_<property>(...) public { ... }
```

Rules:

- always prefer `bound()` over `vm.assume()`
- use `assertEq` for exact math
- use `assertApproxEqAbs` where rounding is expected
- focus on strong properties rather than sheer volume

Typical ranges in this repo:

- USDC: `bound(amount, 1, 1e12)`
- OUSD: `bound(amount, 1e12, 100e18)`
- basis points: `bound(bps, 1, 5000)`
- bounded yield: `bound(yield_, 1, 3e5)`

## 6. Foundry config expectations

Match the repository's fuzz configuration in `contracts/foundry.toml` when relevant. Keep tests deterministic and consistent with existing suite conventions.

## Output expectations

When implementing tests:

- use interface-only imports; no concrete contract imports except mocks
- deploy contracts with `vm.deployCode`, not `new` (mocks are fine with `new`), and reference all artifact paths through `tests/utils/Artifacts.sol` — no inline `"contracts/...sol:Name"` strings
- mirror the existing local test style before inventing new patterns
- prefer coverage that matches real business logic paths over cosmetic line coverage
- add both concrete and fuzz coverage when the function has stateful logic or arithmetic properties
- keep new helpers in `Shared.sol` rather than duplicating setup across test files
