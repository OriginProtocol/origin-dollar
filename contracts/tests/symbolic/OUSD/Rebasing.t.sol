// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import { Symbolic_OUSD_Shared_Test } from "tests/symbolic/OUSD/Shared.t.sol";

/// @notice Foundry translations of the rebase opt-in/out integrity rules in
///         certora/specs/OUSD/OtherInvariants.spec.
contract Symbolic_OUSD_Rebasing_Test is Symbolic_OUSD_Shared_Test {
    /// @dev Translates rebaseOptInIntegrity.
    function check_rebaseOptInIntegrity(address account) external {
        // --- Assumptions
        // Account address
        vm.assume(account != address(0));
        vm.assume(account != address(ousd));
        // Credit per token
        uint256 cpt = ousd.rebasingCreditsPerTokenHighres();
        vm.assume(cpt >= 1e18 && cpt <= 1e27);
        // Account state
        // These assumptions are not redundant: setArbitraryStorage makes the mappings
        // independent and can admit unreachable combinations. Constrain both to model
        // a standard non-rebasing account with normalized credits.
        vm.assume(ousd.rebaseState(account) == 1);
        vm.assume(ousd.nonRebasingCreditsPerToken(account) == 1 ether);
        // Account balance
        // Protocol validity: balance <= totalSupply <= MAX_TOTAL_SUPPLY (2^128 - 1).
        // Property scope: zero-credit accounts and the maximum balance are excluded.
        (uint256 credits, , ) = ousd.creditsBalanceOfHighres(account);
        vm.assume(credits > 0 && credits < type(uint128).max);

        uint256 preBalance = ousd.balanceOf(account);
        vm.assume(ousd.nonRebasingSupply() >= preBalance);

        vm.prank(account);
        ousd.rebaseOptIn();

        uint256 postBalance = ousd.balanceOf(account);

        assertTrue(preBalance == postBalance, "rebaseOptInIntegrity");
    }
}
