// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import { AggregatorV3Interface } from "../interfaces/chainlink/AggregatorV3Interface.sol";
import { StableMath } from "../utils/StableMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/**
 * @notice Price feed when the feed of 2 oracle prices need combining to achieve desired result
 */
contract PriceFeedPair is AggregatorV3Interface, Strategizable {
    using SafeCast for uint256;
    using SafeCast for int256;
    using StableMath for uint256;

    // Fields to make it compatible with `AggregatorV3Interface`
    uint8 public constant override decimals = 18;
    string public constant override description = "";
    uint256 public constant override version = 1;
    address internal immutable addressFeed0;
    address internal immutable addressFeed1;
    bool internal immutable reverseFeed0;
    bool internal immutable reverseFeed1;
    uint8 internal immutable decimalsFeed0;
    uint8 internal immutable decimalsFeed1;

    error PriceFeedAddressError(address _address);

    constructor(
        address _governor,
        address _strategist,
        address _addressFeed0,
        address _addressFeed1,
        bool _reverseFeed0,
        bool _reverseFeed1
    ) {
        _setGovernor(_governor);
        _setStrategistAddr(_strategist);
        if (_addressFeed0 == address(0)) {
            revert PriceFeedAddressError(_addressFeed0);
        }
        if (_addressFeed1 == address(0)) {
            revert PriceFeedAddressError(_addressFeed1);
        }

        decimalsFeed0 = AggregatorV3Interface(_addressFeed0).decimals();
        decimalsFeed1 = AggregatorV3Interface(_addressFeed1).decimals();
        addressFeed0 = _addressFeed0;
        addressFeed1 = _addressFeed1;
        reverseFeed0 = _reverseFeed0;
        reverseFeed1 = _reverseFeed1;
    }

    function _calculatePrice(int256 priceFeed0, int256 priceFeed1)
        internal
        view
        returns (int256)
    {
        uint256 price0 = priceFeed0.toUint256().scaleBy(18, decimalsFeed0);

        if (reverseFeed0) {
            price0 = uint256(1e18).divPrecisely(price0);
        }

        uint256 price1 = priceFeed1.toUint256().scaleBy(18, decimalsFeed1);

        if (reverseFeed1) {
            price1 = uint256(1e18).divPrecisely(price1);
        }

        return price0.mulTruncate(price1).toInt256();
    }

    /**
     * @dev This function exists to make the contract compatible
     * with AggregatorV3Interface (which OETHOracleRouter uses to
     * get the price).
     *
     **/
    function latestRoundData()
        external
        view
        override
        returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        )
    {
        (, int256 _price0, , uint256 updatedAt0, ) = AggregatorV3Interface(
            addressFeed0
        ).latestRoundData();
        (, int256 _price1, , uint256 updatedAt1, ) = AggregatorV3Interface(
            addressFeed1
        ).latestRoundData();
        updatedAt = Math.min(updatedAt0, updatedAt1);
        price = _calculatePrice(_price0, _price1);
    }

    /**
     * @dev This function exists to make the contract compatible
     * with AggregatorV3Interface. The two oracles don't have rounds
     * in sync and for that reason we can not query arbitrary oracle
     * round and combine it.
     **/
    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        )
    {
        revert("No data present");
    }
}
