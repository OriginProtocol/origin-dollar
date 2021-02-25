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
     * @return uint256 USD price of 1 of the asset, in 8 decimal fixed
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
        if (asset == address(0x6B175474E89094C44Da98b954EedeAC495271d0F)) {
            return address(0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9);
        } else if (
            asset == address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
        ) {
            return address(0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6);
        } else if (
            asset == address(0xdAC17F958D2ee523a2206206994597C13D831ec7)
        ) {
            return address(0x3E7d1eAB13ad0104d2750B8863b489D65364e32D);
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
