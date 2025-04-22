// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISwapper {
    /**
     * @param fromAsset The token address of the asset being sold.
     * @param toAsset The token address of the asset being purchased.
     * @param fromAssetAmount The amount of assets being sold.
     * @param minToAssetAmmount The minimum amount of assets to be purchased.
     * @param data tx.data returned from 1Inch's /v5.0/1/swap API
     */
    function swap(
        address fromAsset,
        address toAsset,
        uint256 fromAssetAmount,
        uint256 minToAssetAmmount,
        bytes calldata data
    ) external returns (uint256 toAssetAmount);
}
