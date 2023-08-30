// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// @notice Abstract functionality that is shared between various Oracle Routers
abstract contract OracleRouterBase is IOracle {
    using StableMath for uint256;
    using SafeCast for int256;

    uint256 internal constant MIN_DRIFT = 0.7e18;
    uint256 internal constant MAX_DRIFT = 1.3e18;
    address internal constant FIXED_PRICE =
        0x0000000000000000000000000000000000000001;
    // Maximum allowed staleness buffer above normal Oracle maximum staleness
    uint256 internal constant STALENESS_BUFFER = 1 days;
    mapping(address => uint8) internal decimalsCache;

    /**
     * @dev The price feed contract to use for a particular asset along with
     *      maximum data staleness
     * @param asset address of the asset
     * @return feedAddress address of the price feed for the asset
     * @return maxStaleness maximum acceptable data staleness duration
     */
    function feedMetadata(address asset)
        internal
        view
        virtual
        returns (address feedAddress, uint256 maxStaleness);

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
        (address _feed, uint256 maxStaleness) = feedMetadata(asset);
        require(_feed != address(0), "Asset not available");
        require(_feed != FIXED_PRICE, "Fixed price feeds not supported");

        (, int256 _iprice, , uint256 updatedAt, ) = AggregatorV3Interface(_feed)
            .latestRoundData();

        require(
            updatedAt + maxStaleness >= block.timestamp,
            "Oracle price too old"
        );

        uint8 decimals = getDecimals(_feed);

        uint256 _price = _iprice.toUint256().scaleBy(18, decimals);
        if (shouldBePegged(asset)) {
            require(_price <= MAX_DRIFT, "Oracle: Price exceeds max");
            require(_price >= MIN_DRIFT, "Oracle: Price under min");
        }
        return _price;
    }

    function getDecimals(address _feed) internal view virtual returns (uint8) {
        uint8 decimals = decimalsCache[_feed];
        require(decimals > 0, "Oracle: Decimals not cached");
        return decimals;
    }

    /**
     * @notice Before an asset/feed price is fetches for the first time the
     *         decimals need to be cached. This is a gas optimization
     * @param asset address of the asset
     * @return uint8 corresponding asset decimals
     */
    function cacheDecimals(address asset) external returns (uint8) {
        (address _feed, ) = feedMetadata(asset);
        require(_feed != address(0), "Asset not available");
        require(_feed != FIXED_PRICE, "Fixed price feeds not supported");

        uint8 decimals = AggregatorV3Interface(_feed).decimals();
        decimalsCache[_feed] = decimals;
        return decimals;
    }

    function shouldBePegged(address _asset) internal view returns (bool) {
        string memory symbol = Helpers.getSymbol(_asset);
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        return
            symbolHash == keccak256(abi.encodePacked("DAI")) ||
            symbolHash == keccak256(abi.encodePacked("USDC")) ||
            symbolHash == keccak256(abi.encodePacked("USDT"));
    }
}

// @notice Oracle Router that denominates all prices in USD
contract OracleRouter is OracleRouterBase {
    /**
     * @dev The price feed contract to use for a particular asset along with
     *      maximum data staleness
     * @param asset address of the asset
     * @return feedAddress address of the price feed for the asset
     * @return maxStaleness maximum acceptable data staleness duration
     */
    function feedMetadata(address asset)
        internal
        pure
        virtual
        override
        returns (address feedAddress, uint256 maxStaleness)
    {
        /* + STALENESS_BUFFER is added in case Oracle for some reason doesn't
         * update on heartbeat and we add a generous buffer amount.
         */
        if (asset == 0x6B175474E89094C44Da98b954EedeAC495271d0F) {
            // https://data.chain.link/ethereum/mainnet/stablecoins/dai-usd
            // Chainlink: DAI/USD
            feedAddress = 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;
            maxStaleness = 1 hours + STALENESS_BUFFER;
        } else if (asset == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) {
            // https://data.chain.link/ethereum/mainnet/stablecoins/usdc-usd
            // Chainlink: USDC/USD
            feedAddress = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0xdAC17F958D2ee523a2206206994597C13D831ec7) {
            // https://data.chain.link/ethereum/mainnet/stablecoins/usdt-usd
            // Chainlink: USDT/USD
            feedAddress = 0x3E7d1eAB13ad0104d2750B8863b489D65364e32D;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0xc00e94Cb662C3520282E6f5717214004A7f26888) {
            // https://data.chain.link/ethereum/mainnet/crypto-usd/comp-usd
            // Chainlink: COMP/USD
            feedAddress = 0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5;
            maxStaleness = 1 hours + STALENESS_BUFFER;
        } else if (asset == 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9) {
            // https://data.chain.link/ethereum/mainnet/crypto-usd/aave-usd
            // Chainlink: AAVE/USD
            feedAddress = 0x547a514d5e3769680Ce22B2361c10Ea13619e8a9;
            maxStaleness = 1 hours + STALENESS_BUFFER;
        } else if (asset == 0xD533a949740bb3306d119CC777fa900bA034cd52) {
            // https://data.chain.link/ethereum/mainnet/crypto-usd/crv-usd
            // Chainlink: CRV/USD
            feedAddress = 0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B) {
            // Chainlink: CVX/USD
            feedAddress = 0xd962fC30A72A84cE50161031391756Bf2876Af5D;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else {
            revert("Asset not available");
        }
    }
}

// @notice Oracle Router that denominates all prices in ETH
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
        (address _feed, uint256 maxStaleness) = feedMetadata(asset);
        if (_feed == FIXED_PRICE) {
            return 1e18;
        }
        require(_feed != address(0), "Asset not available");

        (, int256 _iprice, , uint256 updatedAt, ) = AggregatorV3Interface(_feed)
            .latestRoundData();

        require(
            updatedAt + maxStaleness >= block.timestamp,
            "Oracle price too old"
        );

        uint8 decimals = getDecimals(_feed);
        uint256 _price = uint256(_iprice).scaleBy(18, decimals);
        return _price;
    }

    /**
     * @dev The price feed contract to use for a particular asset along with
     *      maximum data staleness
     * @param asset address of the asset
     * @return feedAddress address of the price feed for the asset
     * @return maxStaleness maximum acceptable data staleness duration
     */
    function feedMetadata(address asset)
        internal
        pure
        virtual
        override
        returns (address feedAddress, uint256 maxStaleness)
    {
        if (asset == 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) {
            // FIXED_PRICE: WETH/ETH
            feedAddress = FIXED_PRICE;
            maxStaleness = 0;
        } else if (asset == 0x5E8422345238F34275888049021821E8E08CAa1f) {
            // frxETH/ETH
            feedAddress = 0xC58F3385FBc1C8AD2c0C9a061D7c13b141D7A5Df;
            maxStaleness = 18 hours + STALENESS_BUFFER;
        } else if (asset == 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/steth-eth
            // Chainlink: stETH/ETH
            feedAddress = 0x86392dC19c0b719886221c78AB11eb8Cf5c52812;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0xae78736Cd615f374D3085123A210448E74Fc6393) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/reth-eth
            // Chainlink: rETH/ETH
            feedAddress = 0x536218f9E9Eb48863970252233c8F271f554C2d0;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0xD533a949740bb3306d119CC777fa900bA034cd52) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/crv-eth
            // Chainlink: CRV/ETH
            feedAddress = 0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/cvx-eth
            // Chainlink: CVX/ETH
            feedAddress = 0xC9CbF687f43176B302F03f5e58470b77D07c61c6;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0xBe9895146f7AF43049ca1c1AE358B0541Ea49704) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/cbeth-eth
            // Chainlink: cbETH/ETH
            feedAddress = 0xF017fcB346A1885194689bA23Eff2fE6fA5C483b;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else {
            revert("Asset not available");
        }
    }
}
