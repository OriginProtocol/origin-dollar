// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OUSD } from "./OUSD.sol";

/**
 * @title OETH Token Contract
 * @author Origin Protocol Inc
 */
contract OETH is OUSD {
    function symbol() external pure override returns (string memory) {
        return "OETH";
    }

    function name() external pure override returns (string memory) {
        return "Origin Ether";
    }

    function decimals() external pure override returns (uint8) {
        return 18;
    }
}
