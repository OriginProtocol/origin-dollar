// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { AbstractHarvesterBase } from "./AbstractHarvesterBase.sol";

contract Harvester is AbstractHarvesterBase {
    constructor(address _vault, address _usdtAddress)
        AbstractHarvesterBase(_vault, _usdtAddress)
    {}
}
