// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultCore } from "./VaultCore.sol";

/**
 * @title OETH Plume VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHPlumeVaultCore is VaultCore {
    constructor(address _weth) VaultCore(_weth) {}

    // @inheritdoc VaultCore
    function _mint(
        address,
        uint256 _amount,
        uint256
    ) internal virtual {
        // Only Strategist or Governor can mint using the Vault for now.
        // This allows the strateigst to fund the Vault with WETH when
        // removing liquidi from wOETH strategy.
        require(
            msg.sender == strategistAddr || isGovernor(),
            "Caller is not the Strategist or Governor"
        );

        super._mint(_amount);
    }
}
