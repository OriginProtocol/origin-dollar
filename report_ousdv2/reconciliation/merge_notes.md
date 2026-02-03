# Merge Notes (Minimal Safe Plan)

## Minimal safe merge plan
1) Bring the cross-chain strategy stack from Branch A into Branch B:
   - contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol
   - contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol
   - contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol
   - contracts/contracts/strategies/crosschain/CrossChainStrategyHelper.sol
   - contracts/contracts/proxies/create2/CrossChainStrategyProxy.sol
   (Branch A references: contracts/contracts/strategies/crosschain/*; contracts/contracts/proxies/create2/CrossChainStrategyProxy.sol:19)

2) Reconcile vault strategy selection:
   - Branch B uses setDefaultStrategy and defaultStrategy (contracts/contracts/vault/VaultAdmin.sol:90; contracts/contracts/vault/VaultStorage.sol:202).
   - CrossChainMasterStrategy should be set as defaultStrategy for the single asset in Branch B, replacing Branch A’s per-asset mapping usage (contracts/contracts/vault/VaultAdmin.sol:111 in Branch A).

3) Restore CCTP configuration and deploy scripts in Branch B:
   - contracts/utils/cctp.js (Branch A: contracts/utils/cctp.js:3)
   - contracts/deploy/mainnet/165_crosschain_strategy_proxies.js
   - contracts/deploy/mainnet/166_crosschain_strategy.js
   - contracts/deploy/base/040_crosschain_strategy_proxies.js
   - contracts/deploy/base/041_crosschain_strategy.js
   (Branch A references: contracts/deploy/mainnet/165_crosschain_strategy_proxies.js:4; contracts/deploy/mainnet/166_crosschain_strategy.js:9; contracts/deploy/base/040_crosschain_strategy_proxies.js:4; contracts/deploy/base/041_crosschain_strategy.js:9)

4) Update any IVault integrations to reflect the Branch B API (setDefaultStrategy vs setAssetDefaultStrategy) if the cross-chain deployment scripts are reused.
   - Branch A IVault exposes setAssetDefaultStrategy (contracts/contracts/interfaces/IVault.sol in Branch A: 116).
   - Branch B IVault exposes setDefaultStrategy (contracts/contracts/interfaces/IVault.sol:85).

## Required tests before merge
- Cross-chain tests from Branch A:
  - contracts/test/strategies/crosschain/cross-chain-strategy.js
  - contracts/test/strategies/crosschain/crosschain-master-strategy.mainnet.fork-test.js
  - contracts/test/strategies/crosschain/crosschain-remote-strategy.base.fork-test.js
- Vault rebase and allocation tests for Branch B single-asset model:
  - contracts/test/vault/rebase.js
  - contracts/test/vault/vault.mainnet.fork-test.js (if applicable)

UNKNOWN: If cross-chain tests are updated/relocated in Branch B, update paths accordingly.
