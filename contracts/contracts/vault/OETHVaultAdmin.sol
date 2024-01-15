// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { VaultAdmin } from "./VaultAdmin.sol";

/**
 * @title OETH VaultAdmin Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultAdmin is VaultAdmin {
    constructor(
        address[] memory baseAssets,
        uint8[] memory assetsUnitConversion,
        address _priceProvider
    ) VaultAdmin(baseAssets, assetsUnitConversion, _priceProvider) {}
}
