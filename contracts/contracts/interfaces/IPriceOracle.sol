pragma solidity 0.5.17;

interface IPriceOracle {
    /**
     * @dev returns the asset price in ETH
     */
    function getAssetPrice(address _asset) external view returns (uint256);

    /**
     * @dev sets the asset price, in WEI
     */
    function setAssetPrice(address _asset, uint256 _price) external;

}
