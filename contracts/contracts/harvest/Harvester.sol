// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BaseHarvester } from "./BaseHarvester.sol";

contract Harvester is BaseHarvester {
    constructor(address _vault, address _usdtAddress)
        BaseHarvester(_vault, _usdtAddress)
    {}
}
