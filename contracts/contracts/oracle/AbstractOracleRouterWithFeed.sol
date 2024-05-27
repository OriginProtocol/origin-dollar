// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { OracleRouterBase } from "./OracleRouterBase.sol";
import { StableMath } from "../utils/StableMath.sol";

// @notice Abstract Oracle Router with custom price feed
abstract contract AbstractOracleRouterWithFeed is OracleRouterBase {
    using StableMath for uint256;

    address public immutable priceFeed;

    constructor(address _feed) {
        priceFeed = _feed;
    }

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

        // slither-disable-next-line unused-return
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
}
