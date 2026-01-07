// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultCore } from "./VaultCore.sol";

/**
 * @title OETH Base VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHBaseVaultCore is VaultCore {
    constructor(address _weth) VaultCore(_weth) {}
}
