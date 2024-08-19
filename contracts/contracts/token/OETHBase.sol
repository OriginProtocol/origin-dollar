// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { OUSD } from "./OUSD.sol";
import { InitializableERC20Detailed } from "../utils/InitializableERC20Detailed.sol";

/**
 * @title OETH Token Contract
 * @author Origin Protocol Inc
 */
contract OETHBase is OUSD {
    /**
     * @dev OETHb is already intialized on Base. So `initialize`
     *      cannot be used again. And the `name` and `symbol`
     *      methods aren't `virtual`. That's the reason this
     *      function exists.
     */
    function initialize2() external onlyGovernor {
        InitializableERC20Detailed._initialize("Super OETH", "superOETHb", 18);
    }
}
