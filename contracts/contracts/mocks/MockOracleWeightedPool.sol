// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Variable, OracleAverageQuery, IOracleWeightedPool } from "../interfaces/balancer/IOracleWeightedPool.sol";

contract MockOracleWeightedPool is IOracleWeightedPool {
    uint256[] public nextResults;

    constructor() {
        nextResults = [1 ether, 1 ether];
    }

    function getTimeWeightedAverage(OracleAverageQuery[] memory)
        external
        view
        override
        returns (uint256[] memory results)
    {
        return nextResults;
    }

    function setNextResults(uint256[] calldata results) external {
        nextResults = results;
    }
}
