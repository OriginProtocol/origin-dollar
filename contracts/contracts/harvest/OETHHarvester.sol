// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractHarvester } from "./AbstractHarvester.sol";

contract OETHHarvester is AbstractHarvester {
    constructor(address _vault, address _wethAddress)
        AbstractHarvester(_vault, _wethAddress)
    {}
}
