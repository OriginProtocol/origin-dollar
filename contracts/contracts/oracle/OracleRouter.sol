// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";

abstract contract OracleRouterBase is IOracle {
    using StableMath for uint256;

    uint256 constant MIN_DRIFT = 0.7e18;
    uint256 constant MAX_DRIFT = 1.3e18;
    address constant FIXED_PRICE = 0x0000000000000000000000000000000000000001;
    mapping(address => uint8) internal decimalsCache;

    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     * @return address address of the price feed for the asset
     */
    function feed(address asset) internal view virtual returns (address);

    /**
     * @notice Returns the total price in 18 digit unit for a given asset.
     * @param asset address of the asset
     * @return uint256 unit price for 1 asset unit, in 18 decimal fixed
     */
    function price(address asset)
        external
        view
        virtual
        override
        returns (uint256)
    {
        address _feed = feed(asset);
        require(_feed != address(0), "Asset not available");
        require(_feed != FIXED_PRICE, "Fixed price feeds not supported");
        (, int256 _iprice, , , ) = AggregatorV3Interface(_feed)
            .latestRoundData();
        uint8 decimals = getDecimals(asset);

        uint256 _price = uint256(_iprice).scaleBy(18, decimals);
        if (isStablecoin(asset)) {
            require(_price <= MAX_DRIFT, "Oracle: Price exceeds max");
            require(_price >= MIN_DRIFT, "Oracle: Price under min");
        }
        return uint256(_price);
    }

    function getDecimals(address _asset)
        internal
        view
        returns (uint8)
    {
        require(decimalsCache[_asset] > 0, "Oracle: Decimals not cached");
        return decimalsCache[_asset];
    }

    function cacheDecimals(address _asset) external returns (uint8) {
        address _feed = feed(_asset);
        require(_feed != address(0), "Asset not available");
        require(_feed != FIXED_PRICE, "Fixed price feeds not supported");

        uint8 decimals = AggregatorV3Interface(_feed).decimals();
        decimalsCache[_asset] = decimals;
        return decimals;
    }

    function isStablecoin(address _asset) internal view returns (bool) {
        string memory symbol = Helpers.getSymbol(_asset);
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        return
            symbolHash == keccak256(abi.encodePacked("DAI")) ||
            symbolHash == keccak256(abi.encodePacked("USDC")) ||
            symbolHash == keccak256(abi.encodePacked("USDT"));
    }
}

contract OracleRouter is OracleRouterBase {
    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal pure override returns (address) {
        if (asset == 0x6B175474E89094C44Da98b954EedeAC495271d0F) {
            // Chainlink: DAI/USD
            return 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;
        } else if (asset == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) {
            // Chainlink: USDC/USD
            return 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
        } else if (asset == 0xdAC17F958D2ee523a2206206994597C13D831ec7) {
            // Chainlink: USDT/USD
            return 0x3E7d1eAB13ad0104d2750B8863b489D65364e32D;
        } else if (asset == 0xc00e94Cb662C3520282E6f5717214004A7f26888) {
            // Chainlink: COMP/USD
            return 0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5;
        } else if (asset == 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9) {
            // Chainlink: AAVE/USD
            return 0x547a514d5e3769680Ce22B2361c10Ea13619e8a9;
        } else if (asset == 0xD533a949740bb3306d119CC777fa900bA034cd52) {
            // Chainlink: CRV/USD
            return 0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f;
        } else if (asset == 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B) {
            // Chainlink: CVX/USD
            return 0xd962fC30A72A84cE50161031391756Bf2876Af5D;
        } else if (asset == 0xae78736Cd615f374D3085123A210448E74Fc6393) {
            // Chainlink: rETH/ETH
            return 0x536218f9E9Eb48863970252233c8F271f554C2d0;
        } else if (asset == 0xBe9895146f7AF43049ca1c1AE358B0541Ea49704) {
            // Chainlink: cbETH/ETH
            return 0xF017fcB346A1885194689bA23Eff2fE6fA5C483b;
        } else if (asset == 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84) {
            // Chainlink: stETH/ETH
            return 0x86392dC19c0b719886221c78AB11eb8Cf5c52812;
        } else if (asset == 0x5E8422345238F34275888049021821E8E08CAa1f) {
            // FIXED_PRICE: frxETH/ETH
            return FIXED_PRICE;
        } else if (asset == 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) {
            // FIXED_PRICE: WETH/ETH
            return FIXED_PRICE;
        } else {
            revert("Asset not available");
        }
    }
}

contract OETHOracleRouter is OracleRouter {
    using StableMath for uint256;

    /**
     * @notice Returns the total price in 18 digit units for a given asset.
     *         This implementation does not (!) do range checks as the
     *         parent OracleRouter does.
     * @param asset address of the asset
     * @return uint256 unit price for 1 asset unit, in 18 decimal fixed
     */
    function price(address asset)
        external
        view
        virtual
        override
        returns (uint256)
    {
        address _feed = feed(asset);
        if (_feed == FIXED_PRICE) {
            return 1e18;
        }
        require(_feed != address(0), "Asset not available");
        (, int256 _iprice, , , ) = AggregatorV3Interface(_feed)
            .latestRoundData();

        uint8 decimals = getDecimals(asset);
        uint256 _price = uint256(_iprice).scaleBy(18, decimals);
        return _price;
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
