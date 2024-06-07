// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { AbstractOracleRouterWithFeed } from "./AbstractOracleRouterWithFeed.sol";
import { StableMath } from "../utils/StableMath.sol";

// @notice Oracle Router that denominates all prices in ETH for base network
contract BaseOETHOracleRouter is AbstractOracleRouterWithFeed {
    using StableMath for uint256;

    constructor(address _aeroPriceFeed)
        AbstractOracleRouterWithFeed(_aeroPriceFeed)
    {}

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
        override
        returns (address feedAddress, uint256 maxStaleness)
    {
        if (asset == 0x4200000000000000000000000000000000000006) {
            // FIXED_PRICE: WETH/ETH
            feedAddress = FIXED_PRICE;
            maxStaleness = 0;
        } else if (asset == 0x940181a94A35A4569E4529A3CDfB74e38FD98631) {
            // AERO/ETH
            feedAddress = priceFeed;
            maxStaleness = 1 days;
        } else {
            revert("Asset not available");
        }
    }
}
