// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { VaultCore } from "./VaultCore.sol";

/**
 * @title OETH VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultCore is VaultCore {
    constructor(
        address[] memory baseAssets,
        uint8[] memory assetsUnitConversion,
        address _priceProvider
    ) VaultCore(baseAssets, assetsUnitConversion, _priceProvider) {}
}
