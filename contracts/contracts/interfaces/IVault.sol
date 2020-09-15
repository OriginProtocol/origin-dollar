pragma solidity 0.5.11;

/**
 * @title Vault interface
 */
interface IVault {
    function allocateAsset(address _asset, uint256 _amount) external;

    function withdrawAsset(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external returns (uint256);

    function isSupportedAsset(address _asset) external returns (bool);

    function isRebasePaused() external returns (bool);

    function depositPaused() external returns (bool);

    function priceUSD(address _asset, uint256 _amount)
        external
        returns (uint256);
}
