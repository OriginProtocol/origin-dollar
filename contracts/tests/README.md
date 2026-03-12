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
