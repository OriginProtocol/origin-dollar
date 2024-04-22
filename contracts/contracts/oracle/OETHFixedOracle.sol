// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { OETHOracleRouter } from "./OETHOracleRouter.sol";

// @notice Oracle Router that denominates all prices in ETH
contract OETHFixedOracle is OETHOracleRouter {
    constructor(address _auraPriceFeed) OETHOracleRouter(_auraPriceFeed) {}

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
        // FIXED_PRICE: WETH/ETH
        feedAddress = FIXED_PRICE;
        maxStaleness = 0;
    }
}
