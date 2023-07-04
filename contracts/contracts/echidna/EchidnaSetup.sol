// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IHevm.sol";
import "./EchidnaConfig.sol";
import "./OUSDEchidna.sol";

contract Dummy {}

contract EchidnaSetup is EchidnaConfig {
    IHevm hevm = IHevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    OUSDEchidna ousd = new OUSDEchidna();

    constructor() {
        ousd.initialize("Origin Dollar", "OUSD", ADDRESS_VAULT, 1e18);

        // Deploy dummny contracts as users
        Dummy outsider = new Dummy();
        ADDRESS_OUTSIDER_CONTRACT = address(outsider);
        Dummy dummy0 = new Dummy();
        ADDRESS_CONTRACT0 = address(dummy0);
        Dummy dummy1 = new Dummy();
        ADDRESS_CONTRACT1 = address(dummy1);

        // Start out with a reasonable amount of OUSD
        if (TOGGLE_STARTING_BALANCE) {
            // Rebasing tokens
            hevm.prank(ADDRESS_VAULT);
            ousd.mint(ADDRESS_OUTSIDER_USER, STARTING_BALANCE / 2);

            // Non-rebasing tokens
            hevm.prank(ADDRESS_VAULT);
            ousd.mint(ADDRESS_OUTSIDER_CONTRACT, STARTING_BALANCE / 2);
        }
    }
}
