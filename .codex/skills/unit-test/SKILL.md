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

`Base` owns shared actors, constants, and state variables. Do not redeclare contract storage in `Shared.sol`.

Use the correct product-specific vault type:

- `OUSD` -> `OUSDVault`
- `OETH` -> `OETHVault`
- `OSonic` -> `OSVault`
- `OETHBase` -> `OETHBaseVault`

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

- deploy implementations before ERC1967 proxies
- initialize proxies explicitly
- cast proxies to typed references
- use `vm.startPrank(governor)` for config blocks
- put labels at the end

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

- mirror the existing local test style before inventing new patterns
- prefer coverage that matches real business logic paths over cosmetic line coverage
- add both concrete and fuzz coverage when the function has stateful logic or arithmetic properties
- keep new helpers in `Shared.sol` rather than duplicating setup across test files
