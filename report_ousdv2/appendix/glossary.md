# Glossary

- CrossChainMasterStrategy: Mainnet strategy that bridges USDC and caches remote balances for accounting (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:17,29,141).
- CrossChainRemoteStrategy: Remote-chain strategy that deposits into an ERC-4626 vault and reports balances back (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:22,170,376).
- AbstractCCTPIntegrator: Shared CCTP integration logic for message handling, relaying, and nonce tracking (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:21,290,433,538).
- CCTP MessageTransmitter: On-chain contract allowed to deliver CCTP messages to strategies (AbstractCCTPIntegrator.onlyCCTPMessageTransmitter) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:115).
- Operator: Address allowed to relay CCTP messages to the strategy (AbstractCCTPIntegrator.onlyOperator) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:123).
- defaultStrategy: Single-asset strategy used for allocation in Branch B (contracts/contracts/vault/VaultStorage.sol:202; contracts/contracts/vault/VaultCore.sol:389).
- assetDefaultStrategies: Per-asset default strategy mapping in Branch A (contracts/contracts/vault/VaultStorage.sol:147; contracts/contracts/vault/VaultAdmin.sol:111).
- remoteStrategyBalance: Cached remote balance stored on the master strategy (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:29).
- pendingAmount: Amount bridged but not yet confirmed by remote strategy (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:33).
