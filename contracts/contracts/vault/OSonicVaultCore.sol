// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { OETHVaultCore } from "./OETHVaultCore.sol";

/**
 * @title Origin S VaultCore contract on Sonic
 * @author Origin Protocol Inc
 */
contract OSonicVaultCore is OETHVaultCore {
    /// @param _wS Sonic's Wrapped S token
    constructor(address _wS) OETHVaultCore(_wS) {}

    /**
     * @notice Instant redeem is not supported on Sonic.
     * Use the asynchronous `requestWithdrawal` a `claimWithdrawal` instead.
     */
    function redeem(uint256, uint256) external override {
        revert("unsupported function");
    }
}
