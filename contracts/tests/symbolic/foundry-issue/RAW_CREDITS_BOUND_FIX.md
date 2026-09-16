# OUSD opt-in proof without a credit bound

The previous Forge changes are committed as `9e79f19c4`
(`fix(symbolic): infer safe products from overflow guards`).
This follow-up is a separate, uncommitted change.

Review the [patch against that commit](raw-credit-bound-forge.patch) and the
[validation log, including the binary checksum](raw-credit-bound-validation.log).

`check_rebaseOptInIntegrity` now passes with only two assumptions:

- Global high-resolution CPT is at least `1e18`, with no explicit upper bound.
- The account's alternative CPT is `0` or `1e18`.

There is no explicit credit bound. Both postconditions hold after a successful
opt-in: the balance is unchanged and the alternative CPT is zero.

## What changed in Forge

- Infer operand bounds from retained successful multiplication checks.
- Bound unsigned division results even when the numerator has no known range.
- Infer zero/nonzero operands from scaled checks only when multiplication cannot wrap.
- Revisit newly exposed conjunctions and arithmetic guards using a bounded number
  of simplification passes. Each rewrite excludes its own predicate from its premises.

These are general arithmetic simplifications; they do not depend on OUSD names,
storage slots, or addresses. OUSD production contracts are unchanged.

## Result and scope

The complete OUSD rule passes with 172 paths, 100 queries, 25 SMT queries, and
zero model requests. The previous binary timed out without the credit bound,
including with a 120-second configured timeout.

This is a successful-call proof within Foundry's modeled semantics and configured
bounds. Solidity overflow checks and other reverts remain part of execution;
the rule does not claim that every admitted starting state can complete the call.

The Foundry test suite includes full-width arithmetic and opt-in regressions,
a concrete successful opt-in above `uint128.max`, and counterexamples for
insufficient rates and unchecked overflow.

Validation: 384 symbolic engine tests pass. The full-width integration fixture
passes its two symbolic checks and two concrete witnesses. All three deliberately
invalid arithmetic checks still produce replay-confirmed assertion failures.
Five focused CLI suites pass, including arithmetic conformance and soundness
regressions. Clippy passes with warnings denied, and the changed Rust files pass
the nightly formatter check. The permanent checkout's rebuilt Forge binary
independently confirms the complete OUSD proof.

## Run locally

From `origin-dollar/contracts`:

```sh
../../foundry/target/release/forge test --symbolic \
  --match-path tests/symbolic/OUSD/Rebasing.t.sol \
  --match-test check_rebaseOptInIntegrity \
  --symbolic-timeout 30
```

The follow-up is uncommitted, so the binary's commit hash alone does not identify
all the source changes used to build it.
