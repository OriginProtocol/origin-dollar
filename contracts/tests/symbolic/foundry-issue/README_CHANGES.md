# Foundry symbolic verification: OUSD fix

`check_rebaseOptInIntegrity` now **passes with the locally patched Forge**, including `_adjustGlobals`. The OUSD contract, test, and assumptions were not changed for this fix.

## What changed

1. **Fixed-point arithmetic:** recognize that converting a balance to credits with upward rounding, then back to a balance, preserves the balance under the existing bounds. Every intermediate operation must be proven safe from overflow before this simplification applies.
2. **Signed arithmetic:** use known bounds and signs to simplify addition, subtraction, and conversion checks in `_adjustGlobals`.
3. **Model construction:** combine storage bounds to construct valid examples of feasible execution paths, instead of relying only on a limited list of candidate values.

## Validation

- Original OUSD rule: **timeout on unmodified master → PASS with the patch**.
- Pure arithmetic example and minimal opt-in reproduction: **PASS**.
- Concrete successful opt-in: **PASS**.
- Invalid rates and wrapping arithmetic still produce assertion counterexamples.
- **372 unit tests**, **2 CLI regression tests**, existing arithmetic conformance checks, and Clippy pass.

The proof remains scoped to Foundry's symbolic model and the existing assumptions. A separate, pre-existing arbitrary-storage replay issue is documented in [the detailed notes](LOCAL_FOUNDRY_FIX.md).

Local branch: `codex/ousd-symbolic-roundtrip` in `2-SC/foundry`. Published as [Foundry PR #16849](https://github.com/foundry-rs/foundry/pull/16849), commit `b12aeee71`.
