---
name: fork-test
description: Generate Foundry fork tests for contracts that need real on-chain integration coverage. Use when the user asks for fork tests, mainnet or chain fork coverage, integration tests against live protocol state, or to port Hardhat fork tests into Foundry.
---

# Fork Test

Generate Foundry fork tests for contracts whose behavior depends on real on-chain state, live liquidity, routers, gauges, or oracle reads.

## 0. Check for existing Hardhat fork tests first

Before writing a Foundry fork test, inspect `contracts/test/` for related `*.<chain>.fork-test.js` files and supporting fixtures.

Extract:

- multi-step integration scenarios
- real addresses and parameter values
- expected end-to-end behavior
- whale or impersonation patterns

Adapt them to Foundry; do not copy them blindly.

## 1. Directory layout

```text
contracts/tests/fork/<category>/<ContractName>/
├── shared/
│   └── Shared.t.sol
└── concrete/
    ├── Deposit.t.sol
    ├── Withdraw.t.sol
    └── Rebalance.t.sol
```

Rules:

- fork tests are concrete only; do not add a `fuzz/` directory
- create files only for functions with meaningful on-chain integration behavior
- keep simple setters, access control checks, and pure validation in unit tests

## 2. Inheritance chain

```text
forge-std/Test
  └─ Base
       └─ BaseFork
            └─ Fork_<Contract>_Shared_Test
                 └─ Fork_Concrete_<Contract>_<Feature>_Test
```

`Base` owns shared actors, fork IDs, and contract references. `BaseFork` owns chain fork helpers. Do not redeclare contract storage in `Shared.t.sol`.

Use the correct product-specific vault type:

- `OUSD` -> `OUSDVault` on Mainnet
- `OETH` -> `OETHVault` on Mainnet
- `OSonic` -> `OSVault` on Sonic
- `OETHBase` -> `OETHBaseVault` on Base

## 3. Shared setup contract

`shared/Shared.t.sol` should keep setup in this order:

```solidity
function setUp() public virtual override {
    super.setUp();
    _createAndSelectFork<Chain>();
    _deployFreshContracts();
    _configureContracts();
    label();
}
```

Decision rule:

- deploy fresh contracts that the strategy or vault under test owns or manages
- use forked addresses for external infrastructure such as routers, tokens, factories, and oracles

Pull canonical addresses from `tests/utils/Addresses.sol`.

## 4. Concrete test naming

File and contract naming:

```text
concrete/Deposit.t.sol
Fork_Concrete_<ContractName>_Deposit_Test
```

Function naming patterns:

- `test_<function>()`
- `test_<function>_<behavior>()`
- `test_<function>_RevertWhen_<condition>()`
- `test_<function>_emits<EventName>()`

Casing rules:

- function, behavior, and condition stay `camelCase`
- `RevertWhen` is the only PascalCase token in the test name

## 5. What belongs in fork tests

Fork-test these categories:

- AMO pool interactions
- real router swaps
- oracle reads
- gauge reward flows
- cross-chain and bridge flows
- vault rebases with real balances
- zapper flows
- multi-step end-to-end operations

Do not fork-test:

- simple setters
- straightforward view functions
- access control checks
- constructor validation
- pure math and helper logic
- input-validation-only reverts

Litmus test:

If a mock can faithfully reproduce the behavior, keep it in unit tests.

## 6. Chain mapping

Use the repository's fork helpers and address libraries consistently:

- Mainnet -> `_createAndSelectForkMainnet()`
- Base -> `_createAndSelectForkBase()`
- Sonic -> `_createAndSelectForkSonic()`
- Arbitrum if relevant -> `_createAndSelectForkArbitrum()`

## Output expectations

When implementing fork tests:

- keep them narrowly focused on real integration value
- prefer a few strong end-to-end tests over broad but redundant coverage
- label both fresh and forked contracts for readable traces
- mirror existing fork test structure in the nearest comparable test suite before introducing a new pattern
