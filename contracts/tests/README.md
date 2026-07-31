# Foundry Test Guide

## Test Types

### Unit Tests

Unit tests are the foundation of our test suite and should aim for ~100% coverage on their own.

- **Mock everything external.** Use mock contracts or `vm.mockCall` (when only a single call needs mocking) to isolate the contract under test.
- **Use both concrete and fuzz tests** (see below).
- **Cover all functionality:** setters, views, auth, state transitions, edge cases — everything belongs here.

### Fork Tests

Fork tests complement unit tests for functionality that is impractical to mock, typically integrations with external protocols (Curve, Aerodrome, etc.).

- **Only test integration-specific behavior.** Setters, views, and auth are already covered by unit tests.
- **Deploy our contracts fresh** — do not rely on already-deployed instances of our own contracts.
- **Use real external contracts** that we integrate with (routers, price feeds, etc.).
- **Minimize dependency on current fork state.** For example, an AMO fork test should deploy a new empty pool rather than using an existing one. This prevents tests from breaking when on-chain state drifts.
- **Concrete tests only** — no fuzz tests in fork tests.

### Smoke Tests

Smoke tests verify the health of our live deployments against the real chain state.

- **Deploy nothing.** Use only what is already deployed on-chain.
- **Use real pools and real contracts** — this is the point. Smoke tests confirm that the full production stack works together.
- Fuzz tests may be used here when appropriate.

## Test Styles

### Concrete Tests

Concrete tests use explicit, hand-picked inputs and are the default for all test types. Every test should be concrete unless there is a specific reason to fuzz.

### Fuzz Tests

Fuzz tests let Foundry generate random inputs and should be reserved for **mathematical verification** — e.g. validating invariants, exchange rate calculations, or rounding behavior across a wide input space. They are not a substitute for concrete tests covering specific scenarios.

## Interface-Only Testing

Tests must interact with contracts through their **interfaces**, not their concrete implementations.

### Why

When a test file imports a concrete contract (e.g. `OUSDVault`), Forge pulls its entire dependency tree into the test's compilation unit. A single change in any dependency invalidates the cache for every test that imports it, causing full recompilation. Using interfaces keeps each test's compilation graph small and lets Forge cache aggressively.

### Rules

#### 1. Import the interface, not the contract

```diff
- import {OUSDVault} from "contracts/vault/OUSDVault.sol";
- import {VaultStorage} from "contracts/vault/VaultStorage.sol";
+ import {IVault} from "contracts/interfaces/IVault.sol";
```

#### 2. Declare state variables with the interface type

```diff
- OUSDVault internal ousdVault;
+ IVault internal ousdVault;
```

#### 3. Deploy with `vm.deployCode` instead of `new`

`vm.deployCode` deploys the contract from its artifact without importing the Solidity source, keeping the test compilation unit clean.

```diff
- OUSDVault ousdVaultImpl = new OUSDVault(address(usdc));
+ address ousdVaultImpl = vm.deployCode(
+     "contracts/vault/OUSDVault.sol:OUSDVault",
+     abi.encode(address(usdc))
+ );
```

The path format is `"<source-path>:<ContractName>"`. Constructor arguments are ABI-encoded in the second parameter.

**Proxies** use the same pattern — the path is long but consistent:

```solidity
IProxy proxy = IProxy(
    vm.deployCode(
        "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:InitializeGovernedUpgradeabilityProxy"
    )
);
```

**Contracts without constructor args** (e.g. token implementations) omit the second parameter:

```solidity
IOToken ousdImpl = IOToken(vm.deployCode("contracts/token/OUSD.sol:OUSD"));
```

**Wrapped tokens** pass the underlying token address as a constructor arg:

```solidity
address woethImpl = vm.deployCode(
    "contracts/token/WOETH.sol:WOETH",
    abi.encode(address(oeth))
);
```

#### 4. Cast proxies to the interface

```diff
- ousdVault = OUSDVault(address(ousdVaultProxy));
+ ousdVault = IVault(address(ousdVaultProxy));
```

#### 5. Reference events from the interface

```diff
- emit VaultStorage.CapitalPaused();
+ emit IVault.CapitalPaused();
```

All events used in tests must be declared in the interface.

#### 6. Access struct return values by field name

When a function returns a struct, access fields directly instead of tuple-destructuring. This is cleaner and avoids unused variable warnings, but yes, sometimes you will have to do the call two times if you want the two data from it.

```diff
- (uint128 queued, uint128 claimable, uint128 claimed, uint128 nextIdx) =
-     ousdVault.withdrawalQueueMetadata();
+ uint128 claimable = ousdVault.withdrawalQueueMetadata().claimable;
```

### Gotcha: Rebuild Contracts Before Running Tests

Because `vm.deployCode` loads from compiled artifacts and the contract source is not in the test's dependency tree, `forge test` alone will **not** recompile modified contracts. If you change a contract and only run tests, your tests will silently use the stale artifact.

Always rebuild explicitly after modifying contract source:

```bash
forge build contracts/
forge test ...
```

### Interface Maintenance

When adding new vault functionality (functions, events, or public state variables), add the corresponding signature to the interface (e.g. `IVault.sol`) so tests can use it without importing the concrete contract.

### Available Interfaces

| Interface | File | Used for |
|-----------|------|----------|
| `IVault` | `contracts/interfaces/IVault.sol` | All vault contracts (OUSDVault, OETHVault, etc.) |
| `IOToken` | `contracts/interfaces/IOToken.sol` | All rebasing tokens (OUSD, OETH, OETHBase, OSonic) |
| `IWOToken` | `contracts/interfaces/IWOToken.sol` | All wrapped tokens (WOETH, WOETHBase, WOETHPlume, WOSonic, WrappedOusd) |
| `IProxy` | `contracts/interfaces/IProxy.sol` | All InitializeGovernedUpgradeabilityProxy instances |

### Scope

This pattern applies to **all** contracts under test, not just vaults. Any contract that has an interface should be tested through that interface. If an interface doesn't exist yet, create one.
