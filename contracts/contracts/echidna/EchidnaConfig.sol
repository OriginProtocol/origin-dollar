// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Top-level mixin for configuring the desired fuzzing setup
 * @author Rappie
 */
contract EchidnaConfig {
    address internal constant ADDRESS_VAULT = address(0x10000);
    address internal constant ADDRESS_OUTSIDER_USER = address(0x20000);

    address internal constant ADDRESS_USER0 = address(0x30000);
    address internal constant ADDRESS_USER1 = address(0x40000);

    // Will be set in EchidnaSetup constructor
    address internal ADDRESS_OUTSIDER_CONTRACT;
    address internal ADDRESS_CONTRACT0;
    address internal ADDRESS_CONTRACT1;

    // Toggle known issues
    //
    // This can be used to skip tests that are known to fail. This is useful
    // when debugging a specific issue, but should be disabled when running
    // the full test suite.
    //
    //   True => skip tests that are known to fail
    //   False => run all tests
    //
    bool internal constant TOGGLE_KNOWN_ISSUES = false;

    // Toggle known issues within limits
    //
    // Same as TOGGLE_KNOWN_ISSUES, but also skip tests that are known to fail
    // within limits set by the variables below.
    //
    bool internal constant TOGGLE_KNOWN_ISSUES_WITHIN_LIMITS = true;

    // Starting balance
    //
    // Gives OUSD a non-zero starting supply, which can be useful to ignore
    // certain edge cases.
    //
    // The starting balance is given to outsider accounts that are not used as
    // accounts while fuzzing.
    //
    bool internal constant TOGGLE_STARTING_BALANCE = true;
    uint256 internal constant STARTING_BALANCE = 1_000_000e18;

    // Change supply
    //
    // Set a limit to the amount of change per rebase, which can be useful to
    // ignore certain edge cases.
    //
    //  True => limit the amount of change to a percentage of total supply
    //  False => no limit
    //
    bool internal constant TOGGLE_CHANGESUPPLY_LIMIT = true;
    uint256 internal constant CHANGESUPPLY_DIVISOR = 10; // 10% of total supply

    // Mint limit
    //
    // Set a limit the amount minted per mint, which can be useful to
    // ignore certain edge cases.
    //
    //  True => limit the amount of minted tokens
    //  False => no limit
    //
    bool internal constant TOGGLE_MINT_LIMIT = true;
    uint256 internal constant MINT_MODULO = 1_000_000_000_000e18;

    // Known rounding errors
    uint256 internal constant TRANSFER_ROUNDING_ERROR = 1e18 - 1;
    uint256 internal constant OPT_IN_ROUNDING_ERROR = 1e18 - 1;
    uint256 internal constant MINT_ROUNDING_ERROR = 1e18 - 1;

    /**
     * @notice Modifier to skip tests that are known to fail
     * @dev see TOGGLE_KNOWN_ISSUES for more information
     */
    modifier hasKnownIssue() {
        if (TOGGLE_KNOWN_ISSUES) return;
        _;
    }

    /**
     * @notice Modifier to skip tests that are known to fail within limits
     * @dev see TOGGLE_KNOWN_ISSUES_WITHIN_LIMITS for more information
     */
    modifier hasKnownIssueWithinLimits() {
        if (TOGGLE_KNOWN_ISSUES_WITHIN_LIMITS) return;
        _;
    }

    /**
     * @notice Translate an account ID to an address
     * @param accountId The ID of the account
     * @return account The address of the account
     */
    function getAccount(uint8 accountId)
        internal
        view
        returns (address account)
    {
        accountId = accountId / 64;
        if (accountId == 0) return account = ADDRESS_USER0;
        if (accountId == 1) return account = ADDRESS_USER1;
        if (accountId == 2) return account = ADDRESS_CONTRACT0;
        if (accountId == 3) return account = ADDRESS_CONTRACT1;
        require(false, "Unknown account ID");
    }
}
