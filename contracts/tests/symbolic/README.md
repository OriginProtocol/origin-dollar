# Foundry symbolic testing

This directory contains symbolic tests executed by Foundry's native symbolic
engine.

> [!IMPORTANT]
> This document targets Forge `1.8.1` and forge-std `1.15.0`. Native symbolic
> execution is still described as an opt-in preview, so re-check the official
> documentation and the installed version before relying on these details after
> an upgrade.

## Quick start

Foundry discovers `check*` and `prove*` functions only when symbolic execution
is enabled. `invariant*` and `statefulFuzz*` functions become bounded symbolic
call sequences under the same flag.

```sh
forge test --symbolic \
  --match-path tests/symbolic/OUSD/Rebasing.t.sol \
  --match-test check_rebaseOptInIntegrity
```

Check the local environment with:

```sh
forge --version
foundryup --version
forge test --help | rg symbolic
forge config --json | jq '.symbolic'
z3 --version
```

## Mental model

Forge symbolic execution has three distinct stages:

1. Forge deploys the test contracts and executes `setUp()` concretely.
2. A separate symbolic EVM reads code and initial state from that concrete
   backend, then explores symbolic calldata and symbolic storage expressions.
3. Before reporting a counterexample, Forge executes it again in the concrete
   EVM. A symbolic candidate that cannot be reconstructed is not a confirmed
   counterexample.

This separation explains why a state may be explored symbolically but fail to
replay concretely.

## Storage initialization

### ELI5

| Mode | Behavior |
| --- | --- |
| Default `solidity` | The concrete `setUp` remains, but a mapping read with a symbolic key is unknown. |
| `zero_init` | The concrete `setUp` remains, but a previously unwritten mapping entry is zero. |
| `setArbitraryStorage(target)` | Non-zero setup slots remain; zero slots on `target` become unknown. |
| `setArbitraryStorage(target, true)` | Every slot on `target` becomes unknown, including non-zero setup slots. |
| `generic` | Storage reads are arbitrary for every contract, not just one target. |

### Default `solidity` layout

The default configuration is:

```toml
[profile.default.symbolic]
storage_layout = "solidity"
```

- A concrete slot reads the value produced by `setUp()`.
- A previously unwritten slot addressed through a symbolic Solidity mapping or
  dynamic-array key becomes an abstract symbolic value.
- Forge does not enumerate every concrete backend mapping slot that the
  symbolic key could eventually select.

Consequently, a mapping read such as `balances[account]`, where `account` is a
symbolic argument, is not automatically zero and does not automatically reuse a
balance written for one concrete account during `setUp()`.

### `zero_init`

```solidity
/// forge-config: default.symbolic.storage_layout = "zero_init"
```

`zero_init` changes previously unwritten reads through symbolic keys to zero. It
does not erase concrete storage written during `setUp()`.

In Forge 1.8.1, `zero_init` works through `foundry.toml` and NatSpec
configuration, but the CLI option `--symbolic-storage-layout` only accepts
`solidity` and `generic`.

### `vm.setArbitraryStorage`

forge-std 1.15.0 exposes both overloads:

```solidity
vm.setArbitraryStorage(target);
vm.setArbitraryStorage(target, true);
```

Call it at the end of `setUp()`. Calling it before initialization can make the
initializer read random storage during the concrete setup itself.

Without `true`, Forge preserves concrete **non-zero** slots and makes zero slots
arbitrary. An explicitly written zero should therefore not be treated as fixed
by symbolic execution. With `true`, Forge also replaces non-zero setup slots
with symbolic values.

For a marked target, arbitrary-storage handling takes precedence over
`zero_init`; combining both does not zero-initialize that target's unknown
slots.

Prefer a scoped target over the global `generic` layout. Marking a full protocol
contract arbitrary is useful when intentionally reproducing Certora-style
arbitrary initial state, but it also admits unreachable states until the test
adds the necessary validity constraints.

### Replay limitation

Forge can materialize arbitrary storage for replay only when the effective slot
is concrete. A slot computed from symbolic calldata, such as
`keccak256(account, mappingSlot)`, may be explored symbolically without being
concretely reconstructible. A candidate depending on it can therefore end as
`Incomplete` or `mismatch` instead of a confirmed counterexample.

Treat `generic` as an exploration mode, not as a scoped, replay-friendly
replacement for `setArbitraryStorage(target, true)`.

## Assumptions and properties

- `require(...)` and `vm.assume(...)` prune the path where their condition is
  false.
- Assertions are properties that Forge tries to disprove.
- An ordinary revert terminates only the current path.
- If every path reverts, Forge returns `RevertAll`; this is not a proof.
- A Certora rule normally reasons only about its non-reverting executions. A
  Foundry port should nevertheless ensure that at least one valid path reaches
  the assertions.

Classify assumptions in the test comments:

1. **Protocol validity:** consequences of real invariants.
2. **Property scope:** for example, testing only an EOA or one rebase state.
3. **Solver bounds:** deliberate under-approximations used to make arithmetic
   tractable.

Do not present a solver bound as a protocol invariant. Prefer the widest bound
that follows from the contract's types, supply limits, or overflow conditions.

Address restrictions also reduce the proven domain. In particular,
`account.code.length == 0`, `account != address(0)`, or excluding protocol
addresses should be added only when the property is intentionally restricted to
those accounts. Symbolic code queries range over Foundry's known accounts plus
an empty-account fallback; they are not universal quantification over every
possible external account.

## Reading the result

| Result | Meaning |
| --- | --- |
| `PASS` / `Safe` | All explored and modeled paths satisfy the property within the configured bounds. |
| Confirmed counterexample | A failing symbolic model was successfully replayed concretely. |
| `Incomplete` | Forge could neither prove safety nor confirm a counterexample. |
| `RevertAll` | Every explored path reverted before completing normally. |

A `PASS` is scoped to Foundry's modeled EVM semantics and configured path,
depth, sequence, loop, and dynamic-input bounds.

### Metrics

| Metric | Meaning | Desired direction |
| --- | --- | --- |
| `paths` | Completed symbolic paths | Lower is usually easier, but coverage still matters. |
| `queries` | Normalized solver queries | Lower generally helps. |
| `smt` | Queries actually sent to an SMT backend after local fast paths | Lower generally helps. |
| `sat` | Satisfiability checks requested by the executor | Lower generally helps. |
| `cached` | SAT/model requests served from cache | A larger cached share is useful. |
| `models` | Concrete model requests | Usually zero for a proof; expected for candidate counterexamples. |
| `hard-arith` | Satisfiable witnesses produced by local hard-arithmetic search | Must be zero for a clean proof in Forge 1.8.1. |
| `solver` | Time waiting on solver subprocesses | Diagnostic only; it is not total runtime. |

In Forge 1.8.1, if any hard-arithmetic witness was used and no replayed
counterexample was found, the final result is `Incomplete (Timeout)`. The word
`Timeout` is a result category here: a run showing `solver: 70ms` did not
necessarily exhaust the configured 30-second timeout.

Changing solver or increasing timeout may help actual SMT queries, but it does
not necessarily remove `hard-arith`, because that counter is produced by
Foundry's local handling of difficult arithmetic.

## Reducing symbolic complexity

Change one assumption at a time and compare both the result and metrics.

- Split semantically different cases into separate checks. This both documents
  coverage and avoids carrying unnecessary branches.
- Add cheap structural assumptions before view calls that build expensive
  arithmetic expressions.
- Bound operands before multiplication or division, preferably using real
  protocol or overflow bounds.
- Keep fixed constants concrete when the property does not need them symbolic.
- Avoid symbolic division, large polynomial expressions, and symbolic `EXP`
  where possible.
- Check non-vacuity: at least one path must complete normally.

An extra assumption can increase `paths` because evaluating it creates another
branch before pruning one side. If it does not reduce `hard-arith`, it may still
change the semantic scope; metrics alone do not determine whether it is useful.

Likewise, caching a Solidity result in a local variable does not necessarily
make symbolic execution cheaper. Moving `balanceOf(account)` earlier can force
all its storage reads, branches, multiplication, and division to be constructed
before later assumptions prune the state. Optimize expression construction and
branch ordering, not merely the number of source-level calls.

### Direct storage access

`vm.load` and `vm.store` are modeled by the symbolic engine. Reading a known
fixed slot directly can avoid getter branches and external-call overhead, but it
is not free: the storage expression still enters the symbolic formula. For a
mapping, computing a symbolic Keccak key retains the storage-model and replay
limitations described above.

Use direct slots only when the storage layout is known and intentionally part of
the harness. Prefer public getters when their behavior is part of the property.

## Certora ports

The Certora OUSD rules start from arbitrary storage constrained by explicitly
listed invariants. A normal Foundry `setUp()` instead starts symbolic execution
from one concrete reachable state.

There are three useful Foundry strategies:

1. **Concrete reachable state:** construct the scenario through protocol calls.
   This has strong replay behavior but explores only states reachable from that
   setup.
2. **Hybrid state:** use `setArbitraryStorage(target)` to preserve non-zero
   initialization while making zero/unset fields arbitrary.
3. **Arbitrary initial state:** use `setArbitraryStorage(target, true)`, then
   explicitly encode every relevant validity consequence. This is closest to a
   Certora rule but usually creates the hardest solver and replay problem.

Foundry checks do not directly reproduce Certora's `forall address` invariants
or sums over every mapping entry. For a single-account rule, instantiate the
local and global consequences actually required by the executed function. Be
explicit that this is weaker than assuming the universally quantified
invariant.

### OUSD `rebaseOptInIntegrity` case study

The Certora rule uses more than the visible account conditions:

- `initTotalSupply()` requires a minimum total supply.
- `allAccountValidState()` constrains rebase states, delegation links, and
  `alternativeCreditsPerToken` for all accounts.
- `OtherInvariants.spec` also activates the invariants relating
  `nonRebasingSupply` to all non-rebasing balances and `rebasingCredits_` to all
  rebasing credits.
- It asserts both that the balance is unchanged and that
  `alternativeCreditsPerToken[account] == 0` after `rebaseOptIn()`.

The current Foundry setup initializes OUSD with a global high-resolution CPT of
`1e27`, mints `1 ether` to `operator`, and leaves `nonRebasingSupply` at zero.
Under the default storage layout, a different symbolic account can nevertheless
have arbitrary mapping values. Assuming that this account is non-rebasing with
a positive balance while keeping the concrete global
`nonRebasingSupply == 0` creates an inconsistent state:
`rebaseOptIn()` subtracts the account balance from zero and reverts.

There are also two successful semantic cases in the contract:

1. `StdNonRebasing`, normally with `alternativeCreditsPerToken == 1e18` and a
   possibly positive credit balance.
2. `NotSet` with zero credits/balance, which may explicitly opt in.

Splitting these cases is generally clearer and cheaper than encoding one large
disjunction. Any credits or CPT bound added only for solver performance must be
documented as a proof-scope restriction.

## Useful Forge 1.8.1 features

- `vm.random*` cheatcodes become symbolic value creators during symbolic runs.
- Storage hooks (`registerSloadHook`, `registerSstoreHook`, and
  `registerMappingSstoreHook`) can maintain revert-aware ghost state.
- Mapping hooks expose decoded keys and mapping roots for supported exact
  Solidity Keccak chains.
- Ghost aggregates starting from zero pair naturally with `zero_init`; an
  arbitrary initial mapping instead requires a consistent initial ghost value.
- `--symbolic-dump-smt` prints generated SMT queries and solver diagnostics.
- Solver portfolios can race Z3, Yices, cvc5, and Bitwuzla when those binaries
  are installed.
- Symbolic runs can consume fuzz corpora/frontiers and seed fuzz corpora.
- Confirmed failures can be persisted, replayed, and emitted as Solidity
  regression tests with `--emit-regression`.

Important configuration knobs include:

```toml
[profile.default.symbolic]
solver = "z3"
timeout = 30
max_depth = 10000
max_paths = 1024
max_solver_queries = 10000
exploration_order = "bfs"
invariant_depth = 10
default_dynamic_length = 2
max_dynamic_length = 256
max_calldata_bytes = 4096
symbolic_call_targets = false
dump_smt = false
storage_layout = "solidity"
```

Raising a limit changes whether exploration completes; it does not simplify the
underlying formula. Prefer simplifying state and arithmetic before increasing
limits.

## Known limitations to remember

- Symbolic Keccak uses opaque terms plus Solidity storage-layout heuristics; it
  is not a cryptographic proof of collision or preimage properties.
- Unknown symbolic call targets are limited to known deployed candidates and a
  configurable empty-account fallback, not arbitrary unknown bytecode.
- Dynamic ABI values, invariant sequences, loops, execution depth, path width,
  and solver queries are bounded.
- Some operands must become concrete, including several cheatcode arguments,
  jump destinations, fork identifiers, and bytecode shapes.
- Fork-backed setup is supported, but changing forks or fork blocks during
  symbolic execution is restricted.
- Unsupported semantics must produce `Incomplete`; never interpret that result
  as a successful proof.

## References

- [Foundry v1.8.1 symbolic README](https://github.com/foundry-rs/foundry/blob/v1.8.1/crates/evm/symbolic/README.md)
- [Foundry v1.8.1 symbolic storage implementation](https://github.com/foundry-rs/foundry/blob/v1.8.1/crates/evm/symbolic/src/runtime/state.rs)
- [Foundry v1.8.1 symbolic result handling](https://github.com/foundry-rs/foundry/blob/v1.8.1/crates/evm/symbolic/src/executor/run.rs)
- [Foundry v1.8.0 release notes](https://github.com/foundry-rs/foundry/releases/tag/v1.8.0)
- [`Vm.setArbitraryStorage` interface](../../dependencies/forge-std-1.15.0/src/Vm.sol)
- [OUSD Certora `OtherInvariants.spec`](../../../certora/specs/OUSD/OtherInvariants.spec)
- [OUSD Certora account invariants](../../../certora/specs/OUSD/AccountInvariants.spec)
