pragma solidity 0.5.17;

import { InitializableAdminUpgradeabilityProxy } from "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";

/**
 * @notice VaultProxy delegates calls to a Vault implementation
 * @dev    Extending on OpenZeppelin's InitializableAdminUpgradabilityProxy
 * means that the proxy is upgradable through a ProxyAdmin.
 */
contract VaultProxy is InitializableAdminUpgradeabilityProxy {}
