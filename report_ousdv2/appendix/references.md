# References

## Branches and commits
- Branch A: shah/cross-chain-strategy-cctpv2 @ 2d15f1419
- Branch B: clement/simplify-ousd @ 327a6ebef

## Core contracts (Branch A)
- contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol
- contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol
- contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol
- contracts/contracts/strategies/crosschain/CrossChainStrategyHelper.sol
- contracts/contracts/proxies/create2/CrossChainStrategyProxy.sol
- contracts/contracts/vault/VaultCore.sol
- contracts/contracts/vault/VaultAdmin.sol
- contracts/contracts/vault/VaultStorage.sol
- contracts/contracts/token/OUSD.sol

## Core contracts (Branch B)
- contracts/contracts/vault/OUSDVault.sol
- contracts/contracts/vault/VaultCore.sol
- contracts/contracts/vault/VaultAdmin.sol
- contracts/contracts/vault/VaultStorage.sol
- contracts/contracts/vault/VaultInitializer.sol
- contracts/contracts/token/OUSD.sol

## Deploy/config (Branch A)
- contracts/deploy/mainnet/165_crosschain_strategy_proxies.js
- contracts/deploy/mainnet/166_crosschain_strategy.js
- contracts/deploy/base/040_crosschain_strategy_proxies.js
- contracts/deploy/base/041_crosschain_strategy.js
- contracts/utils/cctp.js

## Deploy/config (Branch B)
- contracts/deploy/mainnet/167_ousd_vault_upgrade.js
