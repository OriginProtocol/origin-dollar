// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHVaultAdmin } from "./OETHVaultAdmin.sol";

/**
 * @title Origin Sonic VaultAdmin contract on Sonic
 * @author Origin Protocol Inc
 */
contract OSonicVaultAdmin is OETHVaultAdmin {
    /// @param _wS Sonic's Wrapped S token
    constructor(address _wS) OETHVaultAdmin(_wS) {}

    /***************************************
                Asset Config
    ****************************************/

    /**
     * @notice Add a supported asset to the contract, i.e. one that can be to mint OTokens.
     * @dev Overridden to remove price provider integration
     * @param _asset Address of asset
     * @param _unitConversion 0 decimals, 1 exchange rate
     */
    function supportAsset(address _asset, uint8 _unitConversion)
        external
        override
        onlyGovernor
    {
        require(!assets[_asset].isSupported, "Asset already supported");

        assets[_asset] = Asset({
            isSupported: true,
            unitConversion: UnitConversion(_unitConversion),
            decimals: 0, // will be overridden in _cacheDecimals
            allowedOracleSlippageBps: 0 // 0% by default
        });

        _cacheDecimals(_asset);
        allAssets.push(_asset);

        emit AssetSupported(_asset);
    }
}
