// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { OracleRouterBase } from "../oracle/OracleRouter.sol";

// @notice Oracle Router required for testing environment
contract MockOracleRouter is OracleRouterBase {
    struct FeedMetadata {
        address feedAddress;
        uint256 maxStaleness;
        uint256 decimals;
    }

    mapping(address => FeedMetadata) public assetToFeedMetadata;

    /* @dev Override feed and maxStaleness information for a particular asset
     * @param _asset the asset to override feed for
     * @param _feed new feed
     * @param _maxStaleness new maximum time allowed for feed data to be stale
     */
    function setFeed(
        address _asset,
        address _feed,
        uint256 _maxStaleness,
        uint256 _decimals
    ) external {
        assetToFeedMetadata[_asset] = FeedMetadata(
            _feed,
            _maxStaleness,
            _decimals
        );
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
        view
        override
        returns (
            address feedAddress,
            uint256 maxStaleness,
            uint256 decimals
        )
    {
        FeedMetadata storage fm = assetToFeedMetadata[asset];
        feedAddress = fm.feedAddress;
        maxStaleness = fm.maxStaleness;
        decimals = fm.decimals;
    }
}
