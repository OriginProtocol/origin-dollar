// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { InitializeGovernedUpgradeabilityProxy } from "./InitializeGovernedUpgradeabilityProxy.sol";

/**
 * @notice OBTCProxy delegates calls to an OBTC implementation
 */
contract OBTCProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice WrappedOBTCProxy delegates calls to a WrappedOBTC implementation
 */
contract WOBTCProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OBTCVaultProxy delegates calls to a Vault implementation
 */
contract OBTCVaultProxy is InitializeGovernedUpgradeabilityProxy {

}
