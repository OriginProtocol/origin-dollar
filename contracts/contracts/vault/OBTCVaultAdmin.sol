// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHVaultAdmin } from "./OETHVaultAdmin.sol";

/**
 * @title OBTC VaultAdmin Contract
 * @author Origin Protocol Inc
 */
contract OBTCVaultAdmin is OETHVaultAdmin {
    constructor(address _wbtc) OETHVaultAdmin(_wbtc) {}
}
