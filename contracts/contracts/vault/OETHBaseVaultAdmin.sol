// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { OETHVaultAdmin } from "./OETHVaultAdmin.sol";

/**
 * @title OETH Base VaultAdmin Contract
 * @author Origin Protocol Inc
 */
contract OETHBaseVaultAdmin is OETHVaultAdmin {
    constructor(address _weth) OETHVaultAdmin(_weth) {}
}
