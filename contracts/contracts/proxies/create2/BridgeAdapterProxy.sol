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
 * @notice BridgeAdapterProxy delegates calls to a concrete
 * crosschainV3 adapter implementation (CCIPAdapter, CCTPAdapter,
 * SuperbridgeAdapter).
 *
 * Deployed via CREATE3 with a coordinated salt across chains so
 * the peer adapter on the destination chain shares this contract's
 * own address — the adapter family relies on that parity to validate
 * inbound `transportSender == address(this)`.
 */
contract BridgeAdapterProxy is InitializeGovernedUpgradeabilityProxy2 {
    constructor(address governor)
        InitializeGovernedUpgradeabilityProxy2(governor)
    {}
}
