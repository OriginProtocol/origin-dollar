// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultCore } from "./VaultCore.sol";

/**
 * @title OUSD VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OUSDVaultCore is VaultCore {
    constructor(address _usdc) VaultCore(_usdc) {}
}
