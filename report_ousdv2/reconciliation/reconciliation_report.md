# Reconciliation Report (Branch A vs Branch B)

## 1) What exists in both branches
- Vault rebase increases OUSD supply using oUSD.changeSupply (Branch A: contracts/contracts/vault/VaultCore.sol:369,467; Branch B: contracts/contracts/vault/VaultCore.sol:424,468; OUSD changeSupply: contracts/contracts/token/OUSD.sol:597).
- Strategy balances are included in vault accounting via IStrategy.checkBalance (Branch A: contracts/contracts/vault/VaultCore.sol:549-562; Branch B: contracts/contracts/vault/VaultCore.sol:591-607; IStrategy: contracts/contracts/interfaces/IStrategy.sol:38).

## 2) Only in Branch A
- Cross-chain strategy stack (master/remote/CCTP integrator/helper) (contracts/contracts/strategies/crosschain/*).
- Create2 proxy for cross-chain strategy (contracts/contracts/proxies/create2/CrossChainStrategyProxy.sol:19).
- Cross-chain deploy scripts and CCTP config (contracts/deploy/mainnet/165_crosschain_strategy_proxies.js:4; contracts/deploy/mainnet/166_crosschain_strategy.js:9; contracts/deploy/base/040_crosschain_strategy_proxies.js:4; contracts/deploy/base/041_crosschain_strategy.js:9; contracts/utils/cctp.js:3).

## 3) Only in Branch B
- Single-asset vault model with defaultStrategy (VaultStorage.defaultStrategy/asset) (contracts/contracts/vault/VaultStorage.sol:202,213).
- Updated OUSDVault wrapper for single-asset (contracts/contracts/vault/OUSDVault.sol:10-11).
- OUSD vault upgrade script using setDefaultStrategy (contracts/deploy/mainnet/167_ousd_vault_upgrade.js:18,51).

## 4) Naming / interface mismatches
- Default strategy selection:
  - Branch A: setAssetDefaultStrategy(asset, strategy) and assetDefaultStrategies mapping (contracts/contracts/vault/VaultAdmin.sol:111; contracts/contracts/vault/VaultStorage.sol:147).
  - Branch B: setDefaultStrategy(strategy) and defaultStrategy storage (contracts/contracts/vault/VaultAdmin.sol:90; contracts/contracts/vault/VaultStorage.sol:202).
- Mint API:
  - Branch A: mint(asset, amount, minOusd) with asset support checks (contracts/contracts/vault/VaultCore.sol:61,80).
  - Branch B: mint(amount) plus deprecated mint(asset, amount, min) overload (contracts/contracts/vault/VaultCore.sol:53,65).

## 5) Accounting model differences
- Branch A is multi-asset and allocates per asset (VaultStorage.assets/allAssets and VaultCore._allocate) (contracts/contracts/vault/VaultStorage.sol:98,100; contracts/contracts/vault/VaultCore.sol:321).
- Branch B is single-asset and ignores non-asset balances (VaultStorage.asset and VaultCore._checkBalance) (contracts/contracts/vault/VaultStorage.sol:213; contracts/contracts/vault/VaultCore.sol:597).
- Branch A cross-chain accounting includes pendingAmount and remoteStrategyBalance in master checkBalance (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:141), which feeds VaultCore._checkBalance in the multi-asset vault (contracts/contracts/vault/VaultCore.sol:549-562).

## 6) Trust boundary differences
- Branch A introduces operator-gated relay and CCTP message handling (AbstractCCTPIntegrator.relay/handleReceiveFinalizedMessage/handleReceiveUnfinalizedMessage) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:290,312,433).
- Branch B has no cross-chain messaging contracts or operator role (expected contracts/contracts/strategies/crosschain/* are absent).
