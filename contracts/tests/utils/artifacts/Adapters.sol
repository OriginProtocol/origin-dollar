// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library Adapters {
    string internal constant CCIP_ADAPTER = "contracts/strategies/crosschainV3/adapters/CCIPAdapter.sol:CCIPAdapter";
    string internal constant SUPERBRIDGE_ADAPTER =
        "contracts/strategies/crosschainV3/adapters/SuperbridgeAdapter.sol:SuperbridgeAdapter";
}
