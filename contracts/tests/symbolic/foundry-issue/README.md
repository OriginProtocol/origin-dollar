# Symbolic: bounded fixed-point round-trip proof times out after #16800

Thanks for fixing #16800! The original external-call reproducer now passes, but our OUSD `rebaseOptIn` check still times out on the merged commit. The remaining issue also reproduces with arithmetic alone, without storage or external calls.

## Minimal reproduction

Save this as `test/RoundTrip.t.sol` in a Forge project with forge-std:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

contract RoundTripTest is Test {
    function check_roundTrip(uint128 balance, uint256 cpt) external pure {
        require(balance > 0 && balance < type(uint128).max);
        require(cpt >= 1e18 && cpt <= 1e27);

        uint256 credits = (uint256(balance) * cpt + 1e18 - 1) / 1e18;
        assert(credits * 1e18 / cpt == balance);
    }
}
```

```sh
forge test --symbolic --match-contract RoundTripTest \
  --use 0.8.28 --optimize --optimizer-runs 200 --symbolic-timeout 30
```

Environment: Forge `1.8.2-dev`, commit `f6606ca720d14e57ef3b6aef22a3108f9bd45315` (merge of #16800), Z3 `4.11.0`, macOS arm64.

## Actual result

The isolated arithmetic check returns:

```text
incomplete symbolic execution (Timeout): symbolic execution timeout exceeded (30s)
```

No counterexample is produced. The SMT dump shows a difficult intermediate check for underflow in `balance * cpt + 1e18 - 1`, although the input bounds already exclude it.

## Expected result

The property should be provable under these bounds. With `W = 1e18`, `B = balance`, `P = cpt`, and `C = ceil(B * P / W)`:

```text
B * P <= C * W < B * P + W <= (B + 1) * P
```

Therefore `floor(C * W / P) == B`. The bounds also prevent overflow in the conversions.

## Full use case

The [OUSD check and setup](https://github.com/OriginProtocol/origin-dollar/tree/0ab59523d8765fe597c7d82dcdc997d1162c3735/contracts/tests/symbolic/OUSD) are pinned to the same Foundry commit. From `contracts/`, run:

```sh
forge test --symbolic --match-contract Symbolic_OUSD_Rebasing_Test \
  --match-test check_rebaseOptInIntegrity --symbolic-timeout 30
```

Could we use both the minimal example and the full OUSD check as regression cases, with a goal of proving them within an agreed timeout while keeping the current symbolic ranges? That would help ensure the fix covers the complete use case beyond the first arithmetic bottleneck.
