// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library Proxies {
    string internal constant CROSS_CHAIN_STRATEGY_PROXY =
        "contracts/proxies/create2/CrossChainStrategyProxy.sol:CrossChainStrategyProxy";
    string internal constant IG_PROXY =
        "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:InitializeGovernedUpgradeabilityProxy";
    string internal constant IG_PROXY_2 =
        "contracts/proxies/InitializeGovernedUpgradeabilityProxy2.sol:InitializeGovernedUpgradeabilityProxy2";
    string internal constant OETH_PROXY = "contracts/proxies/Proxies.sol:OETHProxy";
    string internal constant OETH_VAULT_PROXY = "contracts/proxies/Proxies.sol:OETHVaultProxy";
    string internal constant WOETH_PROXY = "contracts/proxies/Proxies.sol:WOETHProxy";
}
