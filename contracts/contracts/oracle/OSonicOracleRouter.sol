// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHFixedOracle } from "./OETHFixedOracle.sol";

// @notice Oracle Router that returns 1e18 for all prices
// used solely for deployment to testnets
contract OSonicOracleRouter is OETHFixedOracle {
    constructor() OETHFixedOracle() {}
}
