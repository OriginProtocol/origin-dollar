// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { StableMath } from "../utils/StableMath.sol";

// @notice Oracle to fetch AERO Token price that denominates in WETH
contract AeroWEthPriceFeed {
    using StableMath for uint256;

    AggregatorV3Interface public immutable wethUsdPriceFeed;
    AggregatorV3Interface public immutable aeroUsdPriceFeed;

    address public constant AERO_TOKEN_ADDRESS =
        0x940181a94A35A4569E4529A3CDfB74e38FD98631;
    address public constant WETH_TOKEN_ADDRESS =
        0x4200000000000000000000000000000000000006;

    constructor(
        AggregatorV3Interface _wethUsdPriceFeed,
        AggregatorV3Interface _aeroUsdPriceFeed
    ) {
        wethUsdPriceFeed = _wethUsdPriceFeed;
        aeroUsdPriceFeed = _aeroUsdPriceFeed;
    }

    /**
     * @notice Returns the total price in 18 digit units for the given asset.
     *         This implementation does not (!) do range checks as the
     *         parent OracleRouter does.
     * @param asset address of the asset
     * @return uint256 unit price for 1 asset unit, in 18 decimal fixed
     */
    function price(address asset) external view returns (uint256) {
        if (asset == WETH_TOKEN_ADDRESS) {
            return 1e18;
        } else if (asset == AERO_TOKEN_ADDRESS) {
            // slither-disable-next-line unused-return
            (
                ,
                int256 _aeroUsdPrice,
                ,
                uint256 aeroPriceUpdatedAt,

            ) = aeroUsdPriceFeed.latestRoundData();

            require(
                aeroPriceUpdatedAt + 1 days >= // staleness check
                    block.timestamp,
                "AERO_STALE_PRICE"
            );

            (
                ,
                int256 _wethUsdPrice,
                ,
                uint256 ethPriceUpdatedAt,

            ) = wethUsdPriceFeed.latestRoundData();

            require(
                ethPriceUpdatedAt + 1 hours >= block.timestamp, // staleness check
                "ETH_STALE_PRICE"
            );
            // There is no AERO/ETH feed.
            // Get AERO/USD price and divide it with ETH/USD price to fetch the AERO/ETH price.
            uint256 _price = uint256(_aeroUsdPrice).divPrecisely(
                uint256(_wethUsdPrice)
            );

            return _price;
        } else {
            revert("INVALID_ASSET");
        }
    }
}
