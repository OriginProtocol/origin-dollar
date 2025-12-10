// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractHarvester } from "./AbstractHarvester.sol";

contract Harvester is AbstractHarvester {
    constructor(
        address _vault,
        address _usdtAddress,
        address _oracleAddress
    ) AbstractHarvester(_vault, _usdtAddress, _oracleAddress) {}
}
