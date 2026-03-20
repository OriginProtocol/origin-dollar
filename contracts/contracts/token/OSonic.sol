// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OUSD } from "./OUSD.sol";

/**
 * @title Origin Sonic (OS) token on Sonic
 * @author Origin Protocol Inc
 */
contract OSonic is OUSD {
    function symbol() external pure override returns (string memory) {
        return "OS";
    }

    function name() external pure override returns (string memory) {
        return "Origin Sonic";
    }
}
