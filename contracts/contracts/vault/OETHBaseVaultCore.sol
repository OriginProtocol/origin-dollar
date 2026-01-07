// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHVaultCore } from "./OETHVaultCore.sol";

/**
 * @title OETH Base VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHBaseVaultCore is OETHVaultCore {
    constructor(address _weth) OETHVaultCore(_weth) {}
}
