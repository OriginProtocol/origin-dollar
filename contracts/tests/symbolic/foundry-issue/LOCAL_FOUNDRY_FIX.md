# Local Foundry fix for OUSD symbolic verification

The local patch proves the original `check_rebaseOptInIntegrity(address)` without tightening its assumptions. It covers the complete call, including `_adjustGlobals` and signed conversions.

## Checkout and reproduction

- Repository: `/Users/clement/Documents/Travail/Origin/2-SC/foundry`
- Branch: `codex/ousd-symbolic-roundtrip`
- Base: Foundry master `c9ef6c3c1`
- The installed `~/.foundry/bin/forge` has not been replaced.

From the Foundry checkout, build with `cargo build --release -p forge --locked`. Run the resulting binary against OUSD:

```sh
/Users/clement/Documents/Travail/Origin/2-SC/foundry/target/release/forge test \
  --root /Users/clement/Documents/Travail/Origin/2-SC/origin-dollar/contracts \
  --symbolic --match-test check_rebaseOptInIntegrity --symbolic-timeout 30
```

## Changes

- Prove bounded fixed-point round trips after establishing that every intermediate operation cannot overflow.
- Simplify signed addition, subtraction, and conversion guards using established operand bounds.
- Construct feasible models for global storage bounds instead of relying only on a small list of candidate values.

All returned witness models remain subject to validation. Tests cover unsafe rates, modular overflow, conflicting bounds, signed boundaries, and constraints that must not justify their own removal.

## Validation

| Check | Result |
| --- | --- |
| Original OUSD property on unmodified master | Incomplete: timeout |
| Original OUSD property with this patch | PASS |
| Pure fixed-point round trip | PASS |
| Minimal opt-in with arbitrary storage and signed globals | PASS |
| Invalid rate and wrapping arithmetic controls | Replayed assertion counterexamples |
| Concrete opt-in witness | PASS; balance 1, rate 1e18 + 1, resulting credits 2, rebasing credits 102, non-rebasing supply 0 |
| Symbolic engine unit tests | 372 passed |
| Symbolic engine Clippy, all targets, warnings denied | PASS |
| Existing arithmetic/opcode conformance and soundness controls | PASS |
| Final Rust CLI integration regressions | 2 passed |

The real OUSD test and the original pure test were not edited for this fix. The proof retains their existing scope, including the bounds on balances and credits per token, and concerns calls that complete successfully.

## Separate pre-existing counterexample replay limitation

A diagnostic with an intentionally false assertion exposed another issue: with arbitrary storage constrained to a specific value, single-call replay can report `FOUNDRY::ASSUME` as a confirmed counterexample, and minimize the argument to a value that violates an assumption. The same minimal diagnostic reproduces on unmodified master and on the patched binary:

```solidity
interface Vm {
    function assume(bool condition) external pure;
    function setArbitraryStorage(address target, bool overwrite) external;
}
contract State { uint256 public value; }
contract ReplayProbe {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    State target;
    function setUp() public {
        target = new State();
        vm.setArbitraryStorage(address(target), true);
    }
    function checkExactArbitraryAssume(uint256 x) external view {
        vm.assume(x > 0);
        vm.assume(target.value() == 7);
        assert(x == 0);
    }
}
```

This patch addresses the OUSD proof timeout. It does not fix this separate replay limitation, so it should not be presented as a complete solution to every arbitrary-storage workflow.

Published as [Foundry PR #16849](https://github.com/foundry-rs/foundry/pull/16849), from commit `b12aeee71e69d314bd3c64465a84493804c9d519` on `clement-ux/foundry`.
