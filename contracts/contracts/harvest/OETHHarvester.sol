// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BaseHarvester } from "./BaseHarvester.sol";

contract OETHHarvester is BaseHarvester {
    constructor(address _vault, address _wethAddress)
        BaseHarvester(_vault, _wethAddress)
    {}
}
