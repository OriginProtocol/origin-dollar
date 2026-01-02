// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultCore } from "./VaultCore.sol";

/**
 * @title OUSD VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OUSDVaultCore is VaultCore {
    // For future use (because OETHBaseVaultCore inherits from this)
    uint256[50] private __gap;

    constructor(address _usdc) VaultCore(_usdc) {}

    // @inheritdoc VaultCore
    function _redeem(uint256 _amount, uint256 _minimumUnitAmount)
        internal
        virtual
        override
    {
        // Only Strategist or Governor can redeem using the Vault for now.
        // We don't have the onlyGovernorOrStrategist modifier on VaultCore.
        // Since we won't be using that modifier anywhere in the VaultCore as well,
        // the check has been added inline instead of moving it to VaultStorage.
        require(
            msg.sender == strategistAddr || isGovernor(),
            "Caller is not the Strategist or Governor"
        );

        super._redeem(_amount, _minimumUnitAmount);
    }
}
