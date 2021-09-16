// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IOracle } from "../interfaces/IOracle.sol";

abstract contract OracleRouterBase is IOracle {
    uint256 constant MIN_DRIFT = uint256(70000000);
    uint256 constant MAX_DRIFT = uint256(130000000);

    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     * @return address address of the price feed for the asset
     */
    function feed(address asset) internal view virtual returns (address);

    /**
     * @notice Returns the total price in 8 digit USD for a given asset.
     * @param asset address of the asset
     * @return uint256 USD price of 1 of the asset, in 8 decimal fixed
     */
    function price(address asset) external view override returns (uint256) {
        address _feed = feed(asset);
        require(_feed != address(0), "Asset not available");
        (, int256 _iprice, , , ) = AggregatorV3Interface(_feed)
            .latestRoundData();
        uint256 _price = uint256(_iprice);
        require(_price <= MAX_DRIFT, "Oracle: Price exceeds max");
        require(_price >= MIN_DRIFT, "Oracle: Price under min");
        return uint256(_price);
    }
}

contract OracleRouter is OracleRouterBase {
    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal pure override returns (address) {
        if (asset == address(0x6B175474E89094C44Da98b954EedeAC495271d0F)) {
            // Chainlink: DAI/USD
            return address(0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9);
        } else if (
            asset == address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
        ) {
            // Chainlink: USDC/USD
            return address(0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6);
        } else if (
            asset == address(0xdAC17F958D2ee523a2206206994597C13D831ec7)
        ) {
            // Chainlink: USDT/USD
            return address(0x3E7d1eAB13ad0104d2750B8863b489D65364e32D);
        } else if (
            asset == address(0xc00e94Cb662C3520282E6f5717214004A7f26888)
        ) {
            // Chainlink: COMP/USD
            return address(0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5);
        } else if (
            asset == address(0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9)
        ) {
            // Chainlink: AAVE/USD
            return address(0x547a514d5e3769680Ce22B2361c10Ea13619e8a9);
        } else if (
            asset == address(0xD533a949740bb3306d119CC777fa900bA034cd52)
        ) {
            // Chainlink: CRV/USD
            return address(0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f);
        } else {
            revert("Asset not available");
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
    function feed(address asset) internal view override returns (address) {
        return assetToFeed[asset];
    }
}
