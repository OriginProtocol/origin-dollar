# Forge: prove the OUSD rule without a global rate cap

The previous zero-credit fix is saved in Foundry commit `d56fc3cb1`.
The rate-cap follow-up is committed as `9e79f19c4` on
`codex/ousd-symbolic-roundtrip`; it has not been pushed.

The subsequent [credit-bound fix](RAW_CREDITS_BOUND_FIX.md) also removes the
`uint128.max` assumption. The results below describe the earlier rate-cap step.

## ELI5

Forge previously needed both multiplication inputs to be small. Solidity already
checks that their product fits, even when one input is very large. Forge now
uses that successful check to reason about the conversion, preserves the
product's minimum value, and eliminates contradictory scalar bounds locally.

Supporting checks remain in the proof. A condition cannot prove itself, and
unchecked overflow or an insufficient rounding rate still produces a failure.

## OUSD result

The unchanged `check_rebaseOptInIntegrity` passes with both postconditions:
the balance is preserved and the alternative CPT becomes zero.
The binary in the permanent Foundry checkout has been rebuilt and independently
confirmed to pass the rule (168 paths).

The assumptions remain:

- Global CPT `>= 1e18`, with no explicit upper cap.
- Alternative CPT equal to `0` or `1e18`.
- Raw credits `<= uint128.max`, including zero.

This proves the postconditions on successful calls within Foundry's modeled
semantics and configured bounds. It does not assert that every permitted state
can complete the call without reverting.

## Validation

- 378 symbolic engine unit tests pass.
- Five focused CLI suites pass, including arithmetic conformance, soundness
  regressions, and confirmed overflow/rounding counterexamples.
- Clippy passes with warnings denied; changed Rust files are formatted.
- Three concrete OUSD boundary tests pass: a successful rate near `uint256.max`,
  the next rate reverting on checked addition, and zero credits at the maximum
  rate.

The patch against `d56fc3cb1` is saved alongside this file as
`global-cpt-bound-forge.patch`.

## Run locally

From `origin-dollar/contracts`, use the binary from the Foundry checkout:

```sh
../../foundry/target/release/forge test --symbolic \
  --match-path tests/symbolic/OUSD/Rebasing.t.sol \
  --match-test check_rebaseOptInIntegrity \
  --symbolic-timeout 30
```

The new fix is in the working tree, so the version's commit hash alone does
not identify the complete source used to build it.
