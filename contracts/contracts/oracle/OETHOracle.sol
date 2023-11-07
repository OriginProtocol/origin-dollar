// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BaseOracle } from "./BaseOracle.sol";

/**
 * @title OETH Oracle
 * @notice Chainlink style oracle for OETH/ETH
 * @author Origin Protocol Inc
 */
contract OETHOracle is BaseOracle {
    string public constant override description = "OETH / ETH";

    /**
     * @param _oracleUpdater Address of the contract that is authorized to add prices
     */
    constructor(address _oracleUpdater) BaseOracle(_oracleUpdater) {}
}
