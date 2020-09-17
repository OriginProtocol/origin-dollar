pragma solidity 0.5.11;

// prettier-ignore
import { InitializeGovernedUpgradeabilityProxy } from "./InitializeGovernedUpgradeabilityProxy.sol";

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
