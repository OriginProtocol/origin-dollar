# OUSD zero-credit symbolic diagnosis

The current PR binary (7e17546e5) proves the zero-only and positive-only domains separately, but times out when they are combined. The original OUSD test is unchanged by this investigation.

## Reproduction results before the prototype

| Domain | Result |
| --- | --- |
| `credits == 0` | PASS |
| `0 < credits <= type(uint128).max` | PASS |
| `credits <= type(uint128).max` | Incomplete: timeout (30 s) |
| Inclusive domain, restricted to state 1 | Incomplete: timeout (10 s) |
| Inclusive domain with an explicit zero/positive branch | PASS |
| Pure scaled-balance multiplication | Incomplete: timeout (10 s) |

All OUSD variants retain both assertions: balance preservation and clearing the alternative rate.

## Cause

Solidity's checked multiplication of the balance by the rebasing rate includes a zero-or-exact-division guard. After normalizing the balance conversion, the solver sees:

```text
zero = credits * 1e18 < 1e18
safe = zero || (zero ? 0 : credits * rate / credits) == rate
```

The existing `word_bool_always_true` / `checked_mul_guard_side` logic recognizes a literal `credits == 0` guard, but not the equivalent scaled comparison. This leaves an infeasible overflow branch to Z3 as nonlinear 256-bit arithmetic. The captured blocking query is in `blocking-query.smt2`.

The missing equivalence is valid only when the scale is positive and `credits * scale` cannot overflow. The existing credit bound proves that for scale 1e18. The second multiplication also needs its own non-overflow proof.

## Second limitation exposed after the first fix

Recognizing the scaled zero guard removes the first blocking query, but does not by itself prove the complete OUSD rule. A later query in `_adjustGlobals` still asks whether adding a nonnegative global supply to a negative balance delta can produce a result signed-less than that delta.

The rewritten constraint batch already contains `credits != 0`, but the initial contextual pass did not have that simplified fact available. The existing signed guard rewrite therefore misses this impossible branch. `signed-guard-query.smt2` captures this second query.

The second adjustment reuses signed-addition normalization during the later bounded-comparison pass, using only the other retained constraints. It allows that phase to use facts exposed by earlier rewrites.

## Local prototype

`zero-credits-forge.patch` adds bounded recognition of scaled zero checks, reuses the existing checked-multiplication guard simplification, and retries signed-guard normalization with the independently rebuilt context. Regression tests include a real wrapping model when the independent bound is removed.

The prototype is in `/private/tmp/foundry-ousd-symbolic`; it has not been pushed to the Foundry PR or installed as the user's Forge binary.

Without changing Forge, separate zero and positive rules already cover the entire desired credit domain. A passing proof still concerns successful calls under the remaining assumptions; it is not a no-revert guarantee.

The prototype passes all 374 symbolic-engine unit tests. All six diagnostic variants now pass, including the inclusive zero/positive OUSD rule with both assertions. All five focused CLI controls also pass.


## Final end-to-end result

The inclusive test replaces only `credits > 0 && credits <= type(uint128).max` with `credits <= type(uint128).max` in the current user rule. It does not add address, state, or global-supply assumptions.

```text
[PASS] check_diagnosticInclusive(address)
```

The diagnostic file contains the before/after probes; copy it to `contracts/tests/symbolic/OUSD/ZeroCreditsDiagnostic.t.sol` in the OUSD checkout to reproduce. The original user test has not been edited. The two-rule alternative is still valid without this prototype.

The prototype extends the exact same solver source as PR head `7e17546e5`, but its temporary build checkout is based on the original PR base `c9ef6c3c1`. It has not yet been rebuilt on the updated PR branch, committed, or pushed. This is a locally validated candidate, not an independent soundness review.

Clippy passes for all symbolic-crate targets with warnings denied. Rust formatting passes. The exported patch applies cleanly to the current local PR branch (`7e17546e5`).

Full diagnostic sources, solver queries and logs are retained in `/private/tmp/ousd-zero-diagnosis/`.
