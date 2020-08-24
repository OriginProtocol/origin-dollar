pragma solidity 0.5.17;

import {
    InitializableAdminUpgradeabilityProxy
} from "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";

/**
 * @notice OUSDProxy delegates calls to an OUSD implementation
 */
contract OUSDProxy is InitializableAdminUpgradeabilityProxy {

}

/**
 * @notice VaultProxy delegates calls to a Vault implementation
 */
contract VaultProxy is InitializableAdminUpgradeabilityProxy {

}
