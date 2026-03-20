// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { AbstractOracleRouter } from "./AbstractOracleRouter.sol";
import { StableMath } from "../utils/StableMath.sol";
import "../interfaces/chainlink/AggregatorV3Interface.sol";

// @notice Oracle Router (for OETH on Plume) that denominates all prices in ETH
contract OETHPlumeOracleRouter is AbstractOracleRouter {
    using StableMath for uint256;
    using SafeCast for int256;

    address constant WETH = 0xca59cA09E5602fAe8B629DeE83FfA819741f14be;
    address constant WOETH = 0xD8724322f44E5c58D7A815F542036fb17DbbF839;
    // Ref: https://docs.eo.app/docs/eprice/feed-addresses/plume
    address constant WOETH_ORACLE_FEED =
        0x4915600Ed7d85De62011433eEf0BD5399f677e9b;

    constructor() {}

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
        uint256 _price = _iprice.toUint256().scaleBy(18, decimals);
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
        view
        virtual
        override
        returns (address feedAddress, uint256 maxStaleness)
    {
        if (asset == WETH) {
            // FIXED_PRICE: WETH/ETH
            feedAddress = FIXED_PRICE;
            maxStaleness = 0;
        } else if (asset == WOETH) {
            // Chainlink: https://data.chain.link/feeds/base/base/woeth-oeth-exchange-rate
            // Bridged wOETH/OETH
            feedAddress = WOETH_ORACLE_FEED;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else {
            revert("Asset not available");
        }
    }
}
