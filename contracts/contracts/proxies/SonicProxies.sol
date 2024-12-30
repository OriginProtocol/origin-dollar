// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { InitializeGovernedUpgradeabilityProxy } from "./InitializeGovernedUpgradeabilityProxy.sol";

/**
 * @notice OSonicVaultProxy delegates calls to OSonicVault implementation
 */
contract OSonicVaultProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OSonicProxy delegates calls to OSonic implementation
 */
contract OSonicProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice WOSonicProxy delegates calls to WOSonic implementation
 */
contract WOSonicProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OSonicDripperProxy delegates calls to a OSonicDripper implementation
 */
contract OSonicDripperProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice SonicStakingStrategyProxy delegates calls to SonicStakingStrategy implementation
 */
contract SonicStakingStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OSonicHarvesterProxy delegates calls to a OSonicHarvester implementation
 */
contract OSonicHarvesterProxy is InitializeGovernedUpgradeabilityProxy {

}
