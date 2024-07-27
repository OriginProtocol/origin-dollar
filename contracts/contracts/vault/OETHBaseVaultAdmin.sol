// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { VaultAdmin } from "./VaultAdmin.sol";

/**
 * @title OETH Base VaultAdmin Contract
 * @author Origin Protocol Inc
 */
contract OETHBaseVaultAdmin is VaultAdmin {
    function addStrategyToMintWhitelist(address strategyAddr)
        external
        onlyGovernor
    {
        require(strategies[strategyAddr].isSupported, "Strategy not approved");

        require(!mintWhitelistedStrategy[strategyAddr], "Already whitelisted");

        mintWhitelistedStrategy[strategyAddr] = true;

        emit StrategyAddedToMintWhitelist(strategistAddr);
    }

    function removeStrategyFromMintWhitelist(address strategyAddr)
        external
        onlyGovernor
    {
        // Intentionally skipping `strategies.isSupported` check since
        // we may wanna remove an address even after removing the strategy

        require(mintWhitelistedStrategy[strategyAddr], "Not whitelisted");

        mintWhitelistedStrategy[strategyAddr] = false;

        emit StrategyRemovedFromMintWhitelist(strategistAddr);
    }
}
