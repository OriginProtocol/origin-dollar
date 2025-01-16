// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { OETHFixedOracle } from "./OETHFixedOracle.sol";

// @notice Oracle Router that returns 1e18 for all prices
// used solely for deployment to testnets
contract OSonicOracleRouter is OETHFixedOracle {
    constructor(address _auraPriceFeed) OETHFixedOracle(_auraPriceFeed) {}
}
