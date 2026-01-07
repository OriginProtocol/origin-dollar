// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultCore } from "./VaultCore.sol";

/**
 * @title Origin Sonic VaultCore contract on Sonic
 * @author Origin Protocol Inc
 */
contract OSonicVaultCore is VaultCore {
    /// @param _wS Sonic's Wrapped S token
    constructor(address _wS) VaultCore(_wS) {}
}
