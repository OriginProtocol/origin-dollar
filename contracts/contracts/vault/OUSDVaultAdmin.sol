// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultAdmin } from "./VaultAdmin.sol";

/**
 * @title OUSD VaultAdmin Contract
 * @author Origin Protocol Inc
 */
contract OUSDVaultAdmin is VaultAdmin {
    constructor(address _usdc) VaultAdmin(_usdc) {}
}
