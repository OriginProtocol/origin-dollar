// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title OUSD VaultInitializer Contract
 * @notice The Vault contract initializes the vault.
 * @author Origin Protocol Inc
 */

import "./VaultStorage.sol";

contract VaultInitializer is VaultStorage {
    function initialize(address _priceProvider, address _ousd)
        external
        onlyGovernor
        initializer
    {
        require(_priceProvider != address(0), "PriceProvider address is zero");
        require(_ousd != address(0), "oUSD address is zero");

        oUSD = OUSD(_ousd);

        priceProvider = _priceProvider;

        rebasePaused = false;
        capitalPaused = true;

        // Initial redeem fee of 0 basis points
        redeemFeeBps = 0;
        // Initial Vault buffer of 0%
        vaultBuffer = 0;
        // Initial allocate threshold of 25,000 OUSD
        autoAllocateThreshold = 25000e18;
        // Threshold for rebasing
        rebaseThreshold = 1000e18;
    }
}
