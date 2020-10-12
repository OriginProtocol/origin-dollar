pragma solidity 0.5.11;

import {
    InitializeGovernedUpgradeabilityProxy
} from "./InitializeGovernedUpgradeabilityProxy.sol";

/**
 * @notice OUSDProxy delegates calls to an OUSD implementation
 */
contract OUSDProxy is InitializeGovernedUpgradeabilityProxy {

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
 * @notice ThreePoolStrategyProxy delegates calls to a ThreePoolStrategy implementation
 */
contract ThreePoolStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}
