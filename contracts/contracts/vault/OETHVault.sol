// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultAdmin } from "./VaultAdmin.sol";

/**
 * @title OETH VaultAdmin Contract
 * @author Origin Protocol Inc
 */
contract OETHVault is VaultAdmin {
    constructor(address _weth) VaultAdmin(_weth) {}
}
