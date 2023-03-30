// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { InitializeGovernedUpgradeabilityProxy } from "./InitializeGovernedUpgradeabilityProxy.sol";

/**
 * @notice OUSDProxy delegates calls to an OUSD implementation
 */
contract OUSDProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice WrappedOUSDProxy delegates calls to a WrappedOUSD implementation
 */
contract WrappedOUSDProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice VaultProxy delegates calls to a Vault implementation
 */
contract VaultProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice CompoundStrategyProxy delegates calls to a CompoundStrategy implementation
 */
contract CompoundStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice AaveStrategyProxy delegates calls to a AaveStrategy implementation
 */
contract AaveStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice ThreePoolStrategyProxy delegates calls to a ThreePoolStrategy implementation
 */
contract ThreePoolStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice ConvexStrategyProxy delegates calls to a ConvexStrategy implementation
 */
contract ConvexStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice HarvesterProxy delegates calls to a Harvester implementation
 */
contract HarvesterProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice DripperProxy delegates calls to a Dripper implementation
 */
contract DripperProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice MorphoCompoundStrategyProxy delegates calls to a MorphoCompoundStrategy implementation
 */
contract MorphoCompoundStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice ConvexOUSDMetaStrategyProxy delegates calls to a ConvexOUSDMetaStrategy implementation
 */
contract ConvexOUSDMetaStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice ConvexLUSDMetaStrategyProxy delegates calls to a ConvexalGeneralizedMetaStrategy implementation
 */
contract ConvexLUSDMetaStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice MorphoAaveStrategyProxy delegates calls to a MorphoCompoundStrategy implementation
 */
contract MorphoAaveStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHProxy delegates calls to nowhere for now
 */
contract OETHProxy is InitializeGovernedUpgradeabilityProxy {

}
