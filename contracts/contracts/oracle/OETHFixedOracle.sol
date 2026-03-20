// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHOracleRouter } from "./OETHOracleRouter.sol";

// @notice Oracle Router that returns 1e18 for all prices
// used solely for deployment to testnets
contract OETHFixedOracle is OETHOracleRouter {
    constructor() OETHOracleRouter() {}

    /**
     * @dev The price feed contract to use for a particular asset along with
     *      maximum data staleness
     * @param asset address of the asset
     * @return feedAddress address of the price feed for the asset
     * @return maxStaleness maximum acceptable data staleness duration
     */
    // solhint-disable-next-line no-unused-vars
    function feedMetadata(address asset)
        internal
        view
        virtual
        override
        returns (address feedAddress, uint256 maxStaleness)
    {
        // fixes price for all of the assets
        feedAddress = FIXED_PRICE;
        maxStaleness = 0;
    }
}
