// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultCore } from "./VaultCore.sol";

/**
 * @title OETH VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultCore is VaultCore {
    // For future use (because OETHBaseVaultCore inherits from this)
    uint256[50] private __gap;

    constructor(address _weth) VaultCore(_weth) {}
}
