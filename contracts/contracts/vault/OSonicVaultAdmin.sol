// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultAdmin } from "./VaultAdmin.sol";

/**
 * @title Origin Sonic VaultAdmin contract on Sonic
 * @author Origin Protocol Inc
 */
contract OSonicVaultAdmin is VaultAdmin {
    constructor(address _wS) VaultAdmin(_wS) {}
}
