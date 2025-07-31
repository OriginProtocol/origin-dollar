// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHVaultCore } from "./OETHVaultCore.sol";

/**
 * @title Origin Sonic VaultCore contract on Sonic
 * @author Origin Protocol Inc
 */
contract OSonicVaultCore is OETHVaultCore {
    /// @param _wS Sonic's Wrapped S token
    constructor(address _wS) OETHVaultCore(_wS) {}

    /**
     * @notice Instant redeem is not supported on Sonic.
     * Use the asynchronous `requestWithdrawal` a `claimWithdrawal` instead.
     */
    function _redeem(uint256, uint256) internal override {
        revert("unsupported function");
    }
}
