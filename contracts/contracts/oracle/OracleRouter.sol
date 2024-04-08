// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { OracleRouterBase } from "./OracleRouterBase.sol";

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
