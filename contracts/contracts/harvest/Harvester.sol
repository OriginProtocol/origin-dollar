// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { OETHHarvester } from "./OETHHarvester.sol";

contract Harvester is OETHHarvester {
    constructor(address _vault, address _usdtAddress)
        OETHHarvester(_vault, _usdtAddress)
    {}
}
