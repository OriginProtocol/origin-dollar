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

    /**
     * @dev Temporary one-off workaround to recover funds from 
     *      the bribes contract. To be removed later.
     */
    function governanceRecover() external onlyGovernor {
        // Bribes contract
        address _from = 0x685cE0E36Ca4B81F13B7551C76143D962568f6DD;
        // Strategist multisig
        address _to = 0x28bce2eE5775B652D92bB7c2891A89F036619703;
        // Amount to recover
        uint256 amount = 38692983174128797556;
        _executeTransfer(_from, _to, amount);

        emit Transfer(_from, _to, amount);
    }
}
