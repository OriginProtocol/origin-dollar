// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { InitializeGovernedUpgradeabilityProxy } from "./InitializeGovernedUpgradeabilityProxy.sol";

/**
 * @notice OETHPlumeVaultProxy delegates calls to OETHPlumeVault implementation
 */
contract OETHPlumeVaultProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHPlumeProxy delegates calls to OETH implementation
 */
contract OETHPlumeProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice WOETHPlumeProxy delegates calls to WOETH implementation
 */
contract WOETHPlumeProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice RoosterAMOStrategyProxy delegates calls to a RoosterAMOStrategy implementation
 */
contract RoosterAMOStrategyProxy is InitializeGovernedUpgradeabilityProxy {
}