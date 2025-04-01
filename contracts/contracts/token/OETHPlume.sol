// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { OUSD } from "./OUSD.sol";

/**
 * @title Super OETH (Plume) Token Contract
 * @author Origin Protocol Inc
 */
contract OETHPlume is OUSD {
    constructor() {
        // Nobody owns the implementation contract
        _setGovernor(address(0));
    }

    function symbol() external pure override returns (string memory) {
        return "superOETHp";
    }

    function name() external pure override returns (string memory) {
        return "Super OETH";
    }

    function decimals() external pure override returns (uint8) {
        return 18;
    }
}
