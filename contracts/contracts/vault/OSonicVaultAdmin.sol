// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { OETHVaultAdmin } from "./OETHVaultAdmin.sol";

/**
 * @title Origin S VaultAdmin Contract on Sonic
 * @author Origin Protocol Inc
 */
contract OSonicVaultAdmin is OETHVaultAdmin {
    /// @param _wS Sonic's Wrapped S token
    constructor(address _wS) OETHVaultAdmin(_wS) {}
}
