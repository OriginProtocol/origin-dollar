// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EchidnaConfig {
    address internal constant ADDRESS_VAULT = address(0x10000);
    address internal constant ADDRESS_OUTSIDER_USER = address(0x20000);

    address internal constant ADDRESS_USER0 = address(0x30000);
    address internal constant ADDRESS_USER1 = address(0x40000);

    // Will be set in EchidnaSetup constructor
    address internal ADDRESS_OUTSIDER_CONTRACT;
    address internal ADDRESS_CONTRACT0;
    address internal ADDRESS_CONTRACT1;

    bool internal TOGGLE_KNOWN_ISSUES = true;
    bool internal TOGGLE_KNOWN_ISSUES_WITHIN_LIMITS = false;

    bool internal TOGGLE_STARTING_BALANCE = true;
    uint256 internal STARTING_BALANCE = 1_000_000e18;

    bool internal TOGGLE_CHANGESUPPLY_LIMIT = true;
    uint256 internal CHANGESUPPLY_DIVISOR = 10;

    bool internal TOGGLE_MINT_LIMIT = true;
    uint256 internal MINT_MODULO = 1_000_000_000_000e18;

    uint256 internal TRANSFER_ROUNDING_ERROR = 1e18 - 1;
    uint256 internal OPT_IN_ROUNDING_ERROR = 1e18 - 1;
    uint256 internal MINT_ROUNDING_ERROR = 1e18 - 1;

    modifier hasKnownIssue() {
        if (!TOGGLE_KNOWN_ISSUES) return;
        _;
    }

    modifier hasKnownIssueWithinLimits() {
        if (!TOGGLE_KNOWN_ISSUES_WITHIN_LIMITS) return;
        _;
    }

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
