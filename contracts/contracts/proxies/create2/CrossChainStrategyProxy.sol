// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { InitializeGovernedUpgradeabilityProxy2 } from "../InitializeGovernedUpgradeabilityProxy2.sol";

// ********************************************************
// ********************************************************
// IMPORTANT: DO NOT CHANGE ANYTHING IN THIS FILE.
// Any changes to this file (even whitespaces) will
// affect the create2 address of the proxy
// ********************************************************
// ********************************************************

/**
 * @notice CrossChainStrategyProxy delegates calls to a
 * CrossChainMasterStrategy or CrossChainRemoteStrategy
 * implementation contract.
 */
contract CrossChainStrategyProxy is InitializeGovernedUpgradeabilityProxy2 {
    constructor(address governor)
        InitializeGovernedUpgradeabilityProxy2(governor)
    {}
}
