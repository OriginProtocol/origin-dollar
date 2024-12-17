// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { AbstractHarvester } from "./AbstractHarvester.sol";

contract Harvester is AbstractHarvester {
    constructor(address _vault, address _usdtAddress)
        AbstractHarvester(_vault, _usdtAddress)
    {}
}
