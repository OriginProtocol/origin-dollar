# OUSD global CPT upper-bound diagnosis

> Follow-up: the Forge fix and successful validation are documented in [GLOBAL_CPT_BOUND_FIX.md](GLOBAL_CPT_BOUND_FIX.md). The diagnosis below records the earlier failing version.

The upper bound `rebasingCreditsPerToken_ <= 1e27` is not needed for the successful-call balance-preservation argument. Removing it exposes a proof limitation in the current Forge prototype. The observed failure is an incomplete timeout, not a confirmed counterexample.

## Reproduction

The current OUSD rule was copied into temporary diagnostic contracts without changing the user's file. Both variants allow alternative CPT 0 or 1e18 and credits from 0 through uint128.max.

| Variant | Result with the zero-credit Forge prototype |
| --- | --- |
| `1e18 <= cpt <= 1e27` | PASS |
| `cpt >= 1e18` | Incomplete: timeout with a 30 s limit |

The last captured SMT query negates balance preservation while retaining the successful-path arithmetic guards. It contains variable multiplication, division and signed global accounting. The normalizer's `round_up_round_trip` requires operand bounds that establish non-overflow; without a global rate cap, its interval-based product check cannot establish that independently. The runtime guards instead express a relation between balance and rate, which is not sufficient for this existing simplification.

## Why the upper cap is not needed mathematically

Let W = 1e18, P be the global CPT, and B the initial balance. On a successful opt-in, checked Solidity arithmetic computes:

```text
C = floor((B * P + W - 1) / W)
```

The intermediate `B * P + W` must fit in uint256, otherwise the call reverts. Integer rounding gives:

```text
B * P <= C * W <= B * P + W - 1 < (B + 1) * P
```

The last strict inequality follows from P >= W. Consequently:

```text
floor(C * W / P) == B
```

The same inequalities ensure C * W fits after the first conversion succeeds. This argument does not require P <= 1e27. Other eligibility or global-accounting failures can still revert, which this rule does not forbid.

For the allowed alternative rates: rate 1e18 yields B equal to raw credits for states accepted by opt-in; rate zero requires zero raw credits for opt-in eligibility and gives B = 0. The second postcondition follows from the explicit write clearing the alternative CPT.

## Concrete boundary checks

Three concrete tests against the actual OUSD implementation passed:

- B = 1, P = uint256.max - W: opt-in succeeds, balance stays 1, alternative CPT becomes 0.
- B = 1, P = uint256.max - W + 1: opt-in reverts with arithmetic panic 0x11.
- B = 0, P = uint256.max: opt-in succeeds, balance stays 0, alternative CPT becomes 0.

These tests support the source-level argument but do not constitute exhaustive formal verification. The unrestricted symbolic run remains incomplete.

## Scope and next step

Keeping the upper cap produces a bounded proof. Proving the expanded domain automatically requires stronger reasoning from successful-path overflow guards (or a suitable proof decomposition), rather than changing the contract or treating the cap as a necessary safety invariant. No additional Forge fix was implemented in this investigation.

The user's test, Forge binaries and PR were not modified. Diagnostic sources and logs are in `/private/tmp/ousd-rate-bound-diagnosis/`.
