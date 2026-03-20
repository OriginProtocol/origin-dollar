// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { InitializeGovernedUpgradeabilityProxy } from "./InitializeGovernedUpgradeabilityProxy.sol";

/**
 * @notice BridgedBaseWOETHProxy delegates calls to BridgedWOETH implementation
 */
contract BridgedBaseWOETHProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHBaseVaultProxy delegates calls to OETHBaseVault implementation
 */
contract OETHBaseVaultProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHBaseProxy delegates calls to OETH implementation
 */
contract OETHBaseProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice WOETHBaseProxy delegates calls to WOETH implementation
 */
contract WOETHBaseProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHBaseDripperProxy delegates calls to a FixedRateDripper implementation
 */
contract OETHBaseDripperProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice AerodromeAMOStrategyProxy delegates calls to AerodromeAMOStrategy implementation
 */
contract AerodromeAMOStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice BridgedWOETHStrategyProxy delegates calls to BridgedWOETHStrategy implementation
 */
contract BridgedWOETHStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHBaseHarvesterProxy delegates calls to a SuperOETHHarvester implementation
 */
contract OETHBaseHarvesterProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHBaseCurveAMOProxy delegates calls to a OETHBaseCurveAMO implementation
 */
contract OETHBaseCurveAMOProxy is InitializeGovernedUpgradeabilityProxy {

}
