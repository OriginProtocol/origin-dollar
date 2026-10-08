// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { InitializeGovernedUpgradeabilityProxy } from "./InitializeGovernedUpgradeabilityProxy.sol";

/**
 * @title BaseGovernedUpgradeabilityProxy2
 * @dev This is the same as InitializeGovernedUpgradeabilityProxy except that the
 *      governor is defined in the constructor.
 * @author Origin Protocol Inc
 */
contract InitializeGovernedUpgradeabilityProxy2 is
    InitializeGovernedUpgradeabilityProxy
{
    /**
     * This is used when the msg.sender can not be the governor. E.g. when the proxy is
     * deployed via CreateX
     */
    constructor(address governor) InitializeGovernedUpgradeabilityProxy() {
        _setGovernor(governor);
    }
}
