pragma solidity 0.5.11;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IOracle } from "../interfaces/IOracle.sol";

contract OracleRouterBase is IOracle {
    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal view returns (address);

    /**
     * @notice Returns the total price in 8 digit USD for a given asset.
     * @param asset address of the asset
     * @return uint256 USD price of 1 of the asset, in 18 decimal fixed
     */
    function price(address asset) external view returns (uint256) {
        address _feed = feed(asset);
        require(_feed != address(0), "Asset not available");
        (
            uint80 roundID,
            int256 _price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        ) = AggregatorV3Interface(_feed).latestRoundData();
        require(_price > 0, "Oracle price must be greater than zero");
        return uint256(_price);
    }
}

contract OracleRouter is OracleRouterBase {
    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal view returns (address) {
        if (asset == address(0x93)) {
            return address(0x91); // TODO
        } else {
            require(false, "Asset not available");
        }
    }
}

contract OracleRouterDev is OracleRouterBase {
    mapping(address => address) public assetToFeed;

    function setFeed(address _asset, address _feed) external {
        assetToFeed[_asset] = _feed;
    }

    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal view returns (address) {
        return assetToFeed[asset];
    }
}
