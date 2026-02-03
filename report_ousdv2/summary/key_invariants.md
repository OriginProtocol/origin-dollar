# Key Invariants (Code-Backed)

## Cross-chain (Branch A)
- Only the Vault can trigger master deposits and withdrawals (CrossChainMasterStrategy.deposit/withdraw are onlyVault) (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:83,102; contracts/contracts/utils/InitializableAbstractStrategy.sol:150).
- Only the CCTP MessageTransmitter can deliver finalized or unfinalized messages (AbstractCCTPIntegrator.handleReceiveFinalizedMessage/handleReceiveUnfinalizedMessage use onlyCCTPMessageTransmitter) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:290,312,115).
- Only the configured operator can relay CCTP messages (AbstractCCTPIntegrator.relay uses onlyOperator) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:433,123).
- Messages must originate from the configured peer domain and peer strategy address (AbstractCCTPIntegrator._handleReceivedMessage) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338).
- Only one transfer may be in-flight: _getNextNonce reverts if the last nonce is unprocessed, and isTransferPending checks the last nonce (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:538,588).
- The master strategy’s checkBalance includes local USDC, pendingAmount, and cached remoteStrategyBalance (CrossChainMasterStrategy.checkBalance) (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:141).
- The remote strategy only accepts USDC as the asset; deposit/withdraw/checkBalance enforce it (CrossChainRemoteStrategy._deposit/_withdraw/checkBalance) (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:206,300,376).

## Vault accounting and supply
- OUSD supply increases only during vault rebase, which is backed by total value in vault and strategies (VaultCore._rebase; OUSD.changeSupply) (contracts/contracts/vault/VaultCore.sol:424,468; contracts/contracts/token/OUSD.sol:597).
- Strategy balances are included in vault accounting via IStrategy.checkBalance (VaultCore._checkBalance loops strategies) (contracts/contracts/vault/VaultCore.sol:591-607; contracts/contracts/interfaces/IStrategy.sol:38).

## Single-asset vault (Branch B)
- Only the single asset is counted; _checkBalance returns 0 for non-asset (VaultCore._checkBalance) (contracts/contracts/vault/VaultCore.sol:597).
- Allocation uses a single defaultStrategy and the vaultBuffer; excess asset is deposited to defaultStrategy (VaultCore._allocate; VaultStorage.defaultStrategy/vaultBuffer) (contracts/contracts/vault/VaultCore.sol:389-417; contracts/contracts/vault/VaultStorage.sol:202,91).
- Only Governor or Strategist can set defaultStrategy (VaultAdmin.setDefaultStrategy) (contracts/contracts/vault/VaultAdmin.sol:90-105).

## Liveness constraints
- Master withdrawAll skips when a transfer is pending and when remote balance is below the minimum (CrossChainMasterStrategy.withdrawAll) (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:112-123).
- Unfinalized CCTP messages are accepted only if minFinalityThreshold is set to 1000 (AbstractCCTPIntegrator.handleReceiveUnfinalizedMessage) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:312-320).
