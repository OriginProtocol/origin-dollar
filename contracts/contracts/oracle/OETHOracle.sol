// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BaseOracle } from "./BaseOracle.sol";
import { IOracleReceiver } from "./IOracleReceiver.sol";
import { AggregatorV3Interface } from "../interfaces/chainlink/AggregatorV3Interface.sol";
import { Governable } from "../governance/Governable.sol";

/**
 * @title OETH Oracle
 * @notice Chainlink style oracle for OETH/ETH
 * @author Origin Protocol Inc
 */
contract OETHOracle is BaseOracle {
    string public constant override description = "OETH / ETH";

    constructor(address _oracleUpdater) BaseOracle(_oracleUpdater) {}
}
