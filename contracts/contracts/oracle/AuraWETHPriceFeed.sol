// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Variable, OracleAverageQuery, IOracleWeightedPool } from "../interfaces/balancer/IOracleWeightedPool.sol";
import { AggregatorV3Interface } from "../interfaces/chainlink/AggregatorV3Interface.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "hardhat/console.sol";

contract AuraWETHPriceFeed is AggregatorV3Interface {
    using SafeCast for uint256;
    
    uint8 public constant override decimals = 18;
    string public constant override description = "";
    uint256 public constant override version = 1;

    IOracleWeightedPool public immutable auraOracleWeightedPool;

    constructor(address _auraOracleWeightedPool) {
        auraOracleWeightedPool = IOracleWeightedPool(_auraOracleWeightedPool);
    }

    function price() external view returns (int256) {
        return _price();
    }

    function _price() internal view returns (int256) {
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

        uint256[] memory prices = auraOracleWeightedPool.getTimeWeightedAverage(queries);

        // Ensure the price hasn't moved too much (2% tolerance)
        // between now and the past hour
        if (prices[0] > prices[1]) {
            require((1 ether - (1 ether * prices[0] / prices[1])) <= 0.02 ether, "High price volatility");
        } else if (prices[1] > prices[0]) {
            require((1 ether - (1 ether * prices[1] / prices[0])) <= 0.02 ether, "High price volatility");
        }

        // Return the recent price
        return prices[0].toInt256();
    }

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
        ) {
            answer = _price();
            updatedAt = block.timestamp;
        }

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
        ) {
            revert("Not implemented");
        }
}
