// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OUSD } from "./OUSD.sol";

/**
 * @title OETH Token Contract
 * @author Origin Protocol Inc
 */
contract OETHBase is OUSD {
    constructor() {
        // Nobody owns the implementation contract
        _setGovernor(address(0));
    }

    function symbol() external pure override returns (string memory) {
        return "superOETHb";
    }

    function name() external pure override returns (string memory) {
        return "Super OETH";
    }

    function decimals() external pure override returns (uint8) {
        return 18;
    }
}
