// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Symbolic_OUSD_Shared_Test} from "tests/symbolic/OUSD/Shared.t.sol";

/// @notice Foundry translations of the rebase opt-in/out integrity rules in
///         certora/specs/OUSD/OtherInvariants.spec.
contract Symbolic_OUSD_Rebasing_Test is Symbolic_OUSD_Shared_Test {
    /// @dev Translates rebaseOptInIntegrity.
    ///
    /// KNOWN LIMITATION (Forge 1.8.1): this check cannot reach PASS.
    ///
    /// The symbolic engine classifies any DIV/MOD with a symbolic operand as
    /// "hard arithmetic", even a division by a constant such as 1e18. A JUMPI
    /// whose condition contains such an expression is never sent to the SMT
    /// solver: the engine either finds a local heuristic witness (the run then
    /// ends as `Incomplete (Timeout)`, `hard-arith > 0`) or drops the branch
    /// (`solver returned unknown`). See `hard_arith_fallback.rs` and
    /// `is_sat_inner` in `runtime/solver.rs`.
    ///
    /// `_rebaseOptIn` computes `(balance * rebasingCreditsPerToken_ + 1e18 - 1) / 1e18`
    /// and the Solidity overflow / `toInt256` checks that follow are branches on
    /// that quotient. Only the shape `(x * c) / c` is simplified locally, which
    /// is why a `balanceOf`-only check passes but the full opt-in does not.
    ///
    /// Adding assumptions does not help: they prune paths but do not remove the
    /// division from the remaining branch conditions. Bounds from `uint128` down
    /// to `credits < 1000` give the same result. Making `credits` concrete passes
    /// but degrades the check to a unit test.
    ///
    /// Measured (hard-arith / result):
    /// - symbolic account, assumes on getters: 18 / Incomplete
    /// - concrete account, `rebaseState` and `alternativeCreditsPerToken` via
    ///   `vm.store`, `credits` via `vm.load`: 7 / Incomplete
    /// - same + concrete `nonRebasingSupply`: 0 / unknown
    ///
    /// Keep this check as a counterexample detector, not a proof. The rule is
    /// proven by Certora (`OtherInvariants.spec`); Halmos would also prove it
    /// since it hands the division to Z3. A feature request for an opt-in flag
    /// sending hard-arithmetic branches to the solver has been raised with the
    /// Foundry team.
    function check_rebaseOptInIntegrity(address account) external {
        // --- Assumptions
        // Account address
        vm.assume(account != operator);
        vm.assume(account != address(0));
        vm.assume(account != address(ousd));
        // Account state
        vm.assume(ousd.rebaseState(account) == 1);
        vm.assume(ousd.nonRebasingCreditsPerToken(account) == 1 ether);
        // Account balance
        // Protocol validity: balance <= totalSupply <= MAX_TOTAL_SUPPLY (2^128 - 1).
        // Property scope: zero-credit accounts are covered by the NotSet check
        (uint256 credits,,) = ousd.creditsBalanceOfHighres(account);
        vm.assume(credits > 0 && credits < type(uint128).max);

        uint256 preBalance = ousd.balanceOf(account);

        vm.prank(account);
        ousd.rebaseOptIn();

        uint256 postBalance = ousd.balanceOf(account);

        assertTrue(preBalance == postBalance, "rebaseOptInIntegrity");
    }
}
