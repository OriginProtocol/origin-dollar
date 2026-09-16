// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import { Symbolic_OUSD_Shared_Test } from "tests/symbolic/OUSD/Shared.t.sol";

/// @notice Symbolic checks for OUSD rebasing transitions.
contract Symbolic_OUSD_Rebasing_Test is Symbolic_OUSD_Shared_Test {
    // Explicit preconditions for this rule (not a comparison of prover models).
    // Sources: certora/specs/OUSD/{OtherInvariants,AccountInvariants,common}.spec.
    // Certora calls initTotalSupply() and allAccountValidState(), which requires
    // the 12 account invariants listed below. "No" means no explicit assumption;
    // OUSD's own eligibility and checked-arithmetic guards still apply.
    //
    // | Hypothesis / invariant                    | Certora      | Foundry      |
    // | ----------------------------------------- | ------------ | ------------ |
    // | rebasingCreditsPerToken_ >= 1e18          | Yes          | Yes          |
    // | totalSupply >= 1e16                       | Yes          | No           |
    // | DelegationAccountsCorrelation             | All accounts | No           |
    // | DelegationValidRebaseState                | All accounts | No           |
    // | stdNonRebasingDoesntYield                 | All accounts | No           |
    // | alternativeCreditsPerTokenIsOneOrZeroOnly | All accounts | Account only |
    // | yieldDelegationSourceHasNonZeroYeildTo    | All accounts | No           |
    // | yieldDelegationTargetHasNonZeroYeildFrom  | All accounts | No           |
    // | yieldToOfZeroIsZero                       | Yes          | No           |
    // | yieldFromOfZeroIsZero                     | Yes          | No           |
    // | cantYieldToSelf                           | All accounts | No           |
    // | cantYieldFromSelf                         | All accounts | No           |
    // | zeroAlternativeCreditsPerTokenStates      | All accounts | No           |
    // | nonZeroAlternativeCreditsPerTokenStates   | All accounts | No           |
    //
    // Neither rule explicitly requires credits > 0, credits <= uint128.max,
    // an upper bound on the global rate, or an upper bound on totalSupply.
    // Defining MAX_TOTAL_SUPPLY does not impose it; the imported global-sum
    // invariants are not required by this Certora rule either.
    // Both check balance preservation and a zero alternative rate on
    // non-reverting paths; neither proves that every admitted state can opt in.

    /// @notice Checks that opting into rebasing preserves the account's balance
    ///         and resets its alternative credits-per-token rate to zero.
    /// @dev Starts from arbitrary storage, assuming a global rate >= 1e18 and
    ///      an account alternative rate of either 0 or 1e18. Zero credits are allowed,
    ///      with no explicit upper bound on credits or the global rate.
    ///      Checks only paths where the balance reads and opt-in do not revert.
    /// @param account The account calling rebaseOptIn and whose balance is checked.
    function check_rebaseOptInIntegrity(address account) external {
        // --- Assumptions
        // Ensure conversion to rebasing credits and back preserves the balance
        // despite rounding, provided the checked arithmetic succeeds.
        uint256 cpt = ousd.rebasingCreditsPerTokenHighres();
        vm.assume(cpt >= 1e18);
        // Restrict the account to the global rate (0) or a fixed rate of 1e18,
        // where each stored credit equals one base unit of token balance.
        uint256 nonRebasingCPT = ousd.nonRebasingCreditsPerToken(account);
        vm.assume(nonRebasingCPT == 0 || nonRebasingCPT == 1e18);

        // --- Action
        uint256 preBalance = ousd.balanceOf(account);
        vm.prank(account);
        ousd.rebaseOptIn();

        // --- Postconditions
        // The balance must be unchanged, and the account must use the global rate.
        uint256 postBalance = ousd.balanceOf(account);
        assertEq(preBalance, postBalance, "rebaseOptInIntegrity");
        assertEq(
            ousd.nonRebasingCreditsPerToken(account),
            0,
            "nonRebasingCreditsPerToken"
        );
    }
}
