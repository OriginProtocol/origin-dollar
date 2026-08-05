// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultAdmin } from "./VaultAdmin.sol";

/**
 * @title Origin Sonic VaultAdmin contract on Sonic
 * @author Origin Protocol Inc
 */
contract OSVault is VaultAdmin {
    constructor(address _wS) VaultAdmin(_wS) {}

    /// @dev Restricts asset-backed mints to protocol-controlled accounts.
    function _mint(uint256 _amount) internal virtual override {
        // Keep minting available for protocol operations while disabling
        // public mints during the Sonic vault sunset.
        require(
            msg.sender == strategistAddr || isGovernor(),
            "Caller is not the Strategist or Governor"
        );

        super._mint(_amount);
    }
}
