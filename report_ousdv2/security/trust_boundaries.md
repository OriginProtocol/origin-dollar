# Trust Boundaries

## Branch A (cross-chain)
- Governor: Can upgrade proxies and change CCTP parameters (AbstractCCTPIntegrator.setOperator/setMinFinalityThreshold/setFeePremiumBps; InitializeGovernedUpgradeabilityProxy.upgradeTo) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:215,235,262; contracts/contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:76).
- Strategist: Can configure vault strategy mappings and move funds via deposit/withdraw strategy functions (VaultAdmin.setAssetDefaultStrategy/depositToStrategy/withdrawFromStrategy) (contracts/contracts/vault/VaultAdmin.sol:111,533,573).
- Operator: Sole relayer for CCTP messages (AbstractCCTPIntegrator.relay) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:433).
- CCTP MessageTransmitter: Only contract that can deliver finalized/unfinalized messages (AbstractCCTPIntegrator.handleReceiveFinalizedMessage/handleReceiveUnfinalizedMessage) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:290,312).
- CCTP TokenMessenger: Custody boundary for burn/mint process (AbstractCCTPIntegrator._sendTokens uses depositForBurnWithHook) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:359-391).
- ERC-4626 vault on remote chain: Strategy asset growth and withdrawal depend on external vault behavior (CrossChainRemoteStrategy._deposit/_withdraw) (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:206-333).

## Branch B (single-asset vault)
- Governor: Controls defaultStrategy, strategy approvals, and pause controls (VaultAdmin.setDefaultStrategy/approveStrategy/pauseCapital) (contracts/contracts/vault/VaultAdmin.sol:90,168,404).
- Strategist: Can set defaultStrategy and move funds between vault and strategies (VaultAdmin.setDefaultStrategy/depositToStrategy/withdrawFromStrategy) (contracts/contracts/vault/VaultAdmin.sol:90,270,312).
- Default strategy: Strategy.checkBalance drives vault accounting and rebase (VaultCore._checkBalance) (contracts/contracts/vault/VaultCore.sol:591-607).

UNKNOWN: Cross-chain trust boundaries in Branch B (no crosschain contracts present; expected contracts/contracts/strategies/crosschain/*).
