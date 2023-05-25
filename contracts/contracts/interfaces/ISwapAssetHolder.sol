pragma solidity ^0.8.0;

interface ISwapAssetHolder {
    function prepareSwap(
        address assetHolder,
        address fromAsset,
        address toAsset
    ) external;
}
