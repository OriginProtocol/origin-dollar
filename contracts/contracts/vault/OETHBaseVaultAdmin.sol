// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { VaultAdmin } from "./VaultAdmin.sol";

/**
 * @title OETH Base VaultAdmin Contract
 * @author Origin Protocol Inc
 */
contract OETHBaseVaultAdmin is VaultAdmin {
    /**
     * @notice Adds a strategy to the mint whitelist.
     *          Reverts if strategy isn't approved on Vault.
     * @param strategyAddr Strategy address
     */
    function addStrategyToMintWhitelist(address strategyAddr)
        external
        onlyGovernor
    {
        require(strategies[strategyAddr].isSupported, "Strategy not approved");

        require(
            !isMintWhitelistedStrategy[strategyAddr],
            "Already whitelisted"
        );

        isMintWhitelistedStrategy[strategyAddr] = true;

        emit StrategyAddedToMintWhitelist(strategistAddr);
    }

    /**
     * @notice Removes a strategy from the mint whitelist.
     * @param strategyAddr Strategy address
     */
    function removeStrategyFromMintWhitelist(address strategyAddr)
        external
        onlyGovernor
    {
        // Intentionally skipping `strategies.isSupported` check since
        // we may wanna remove an address even after removing the strategy

        require(isMintWhitelistedStrategy[strategyAddr], "Not whitelisted");

        isMintWhitelistedStrategy[strategyAddr] = false;

        emit StrategyRemovedFromMintWhitelist(strategistAddr);
    }
}
