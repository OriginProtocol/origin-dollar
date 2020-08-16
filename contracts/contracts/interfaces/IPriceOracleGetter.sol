pragma solidity ^0.5.17;

interface IPriceOracleGetter {
    /**
     * @dev Returns the asset price in ETH
     */
    function getAssetPrice(address _asset) external view returns (uint256);
}
