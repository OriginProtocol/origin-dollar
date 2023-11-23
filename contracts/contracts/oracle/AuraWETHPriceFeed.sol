// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Variable, OracleAverageQuery, IOracleWeightedPool } from "../interfaces/balancer/IOracleWeightedPool.sol";
import { Strategizable } from "../governance/Strategizable.sol";
import { AggregatorV3Interface } from "../interfaces/chainlink/AggregatorV3Interface.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract AuraWETHPriceFeed is AggregatorV3Interface, Strategizable {
    using SafeCast for uint256;
    using SafeCast for int256;

    event PriceFeedPaused();
    event PriceFeedUnpaused();
    event ToleranceChanged(uint256 oldTolerance, uint256 newTolerance);

    error PriceFeedPausedError();
    error PriceFeedUnpausedError();
    error InvalidToleranceBps();
    error HighPriceVolatility(uint256 deviation);

    bool public paused;
    uint256 public tolerance = 0.02 ether; // 2% by default

    // Fields to make it compatible with `AggregatorV3Interface`
    uint8 public constant override decimals = 18;
    string public constant override description = "";
    uint256 public constant override version = 1;

    IOracleWeightedPool public immutable auraOracleWeightedPool;

    constructor(address _auraOracleWeightedPool, address _governor) {
        _setGovernor(_governor);
        auraOracleWeightedPool = IOracleWeightedPool(_auraOracleWeightedPool);
    }

    /**
     * @dev Queries the OracleWeightedPool for TWAP of two intervals
     * (1h data from 5m ago and the recent 5m data) and ensures that
     * the price hasn't deviated too much and returns the most recent
     * TWAP price.
     *
     * @return price The price scaled to 18 decimals
     **/
    function price() external view returns (int256) {
        return _price();
    }

    function _price() internal view returns (int256) {
        if (paused) {
            revert PriceFeedPausedError();
        }
        OracleAverageQuery[] memory queries = new OracleAverageQuery[](2);

        queries[0] = OracleAverageQuery({
            variable: Variable.PAIR_PRICE,
            secs: 3600, // Get 1h data
            ago: 300 // From 5min ago
        });
        queries[1] = OracleAverageQuery({
            variable: Variable.PAIR_PRICE,
            secs: 300, // Get 5min data
            ago: 0 // From now
        });

        uint256[] memory prices = auraOracleWeightedPool.getTimeWeightedAverage(
            queries
        );
        int256 price_1h = prices[0].toInt256();
        int256 price_5m = prices[1].toInt256();

        int256 diff = (1e18 * (price_1h - price_5m)) /
            ((price_1h + price_5m) / 2);
        uint256 absDiff = diff >= 0 ? diff.toUint256() : (-diff).toUint256();

        // Ensure the price hasn't moved too much (2% tolerance)
        // between now and the past hour
        if (absDiff > tolerance) {
            revert HighPriceVolatility(absDiff);
        }

        // Return the recent price
        return price_5m;
    }

    /**
     * Pauses the price feed. Callable by Strategist as well.
     **/
    function pause() external onlyGovernorOrStrategist {
        if (paused) {
            revert PriceFeedPausedError();
        }
        paused = true;
        emit PriceFeedPaused();
    }

    /**
     * Unpauses the price feed. Only Governor can call it
     **/
    function unpause() external onlyGovernor {
        if (!paused) {
            revert PriceFeedUnpausedError();
        }
        paused = false;
        emit PriceFeedUnpaused();
    }

    /**
     * Set the max amount of tolerance acceptable between
     * two different price points.
     *
     * @param _tolerance New tolerance value
     **/
    function setTolerance(uint256 _tolerance) external onlyGovernor {
        if (_tolerance > 0.1 ether) {
            revert InvalidToleranceBps();
        }
        emit ToleranceChanged(tolerance, _tolerance);
        tolerance = _tolerance;
    }

    /**
     * @dev This function exists to make the contract compatible
     * with AggregatorV3Interface (which OETHOracleRouter uses to
     * get the price).
     *
     * The `answer` returned by this is same as what `price()` would return.
     *
     * It doesn't return any data about rounds (since those doesn't exist).
     **/
    function latestRoundData()
        external
        view
        override
        returns (
            uint80,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80
        )
    {
        answer = _price();
        updatedAt = block.timestamp;
    }

    /**
     * @dev This function exists to make the contract compatible
     * with AggregatorV3Interface.
     *
     * Always reverts since there're no round data in this contract.
     **/
    function getRoundData(uint80)
        external
        pure
        override
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        revert("No data present");
    }
}
