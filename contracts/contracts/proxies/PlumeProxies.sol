// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { InitializeGovernedUpgradeabilityProxy } from "./InitializeGovernedUpgradeabilityProxy.sol";

/**
 * @notice BridgedPlumeWOETHProxy delegates calls to BridgedWOETH implementation
 */
contract BridgedPlumeWOETHProxy is InitializeGovernedUpgradeabilityProxy {

}

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
