# Executive Summary - Phase 2 Multichain Yield Distribution

## Purpose and design (code-backed)
Phase 2 introduces a cross-chain strategy split into a mainnet master and a remote strategy that uses Circle CCTP to move USDC across chains while keeping OUSD accounting on mainnet. The master strategy holds cached remote balances and pending amounts to inform Vault accounting (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:29,33,141). The remote strategy receives bridged USDC, deposits into an ERC-4626 vault, and sends balance updates back to the master (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:170,206,241,376). CCTP message handling, relaying, and nonce control are centralized in AbstractCCTPIntegrator (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:290,312,433,538,588).

## What is implemented today (by branch)
- Branch A (shah/cross-chain-strategy-cctpv2): Full cross-chain strategy stack exists, including CrossChainMasterStrategy, CrossChainRemoteStrategy, CrossChainStrategyHelper, and AbstractCCTPIntegrator (contracts/contracts/strategies/crosschain/*). Mainnet and Base deploy scripts wire the create2 proxy and implementations (contracts/deploy/mainnet/165_crosschain_strategy_proxies.js:4, contracts/deploy/mainnet/166_crosschain_strategy.js:9, contracts/deploy/base/040_crosschain_strategy_proxies.js:4, contracts/deploy/base/041_crosschain_strategy.js:9). CCTP domain IDs are configured in contracts/utils/cctp.js:3.
- Branch B (clement/simplify-ousd): The cross-chain strategy contracts are not present. The OUSD vault is refactored into a single-asset model with a default strategy (contracts/contracts/vault/VaultStorage.sol:202,213; contracts/contracts/vault/VaultCore.sol:389). A deployment script upgrades OUSD Vault and sets default strategy (contracts/deploy/mainnet/167_ousd_vault_upgrade.js:18,51).

## What differs between branches
- Strategy allocation model: Branch A uses per-asset default strategies (assetDefaultStrategies mapping) (contracts/contracts/vault/VaultStorage.sol:147; contracts/contracts/vault/VaultAdmin.sol:111). Branch B uses a single defaultStrategy for a single asset (contracts/contracts/vault/VaultStorage.sol:202,213; contracts/contracts/vault/VaultAdmin.sol:90).
- Cross-chain messaging and accounting: Present in Branch A via CCTP integrator and helper (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:359,408,433; contracts/contracts/strategies/crosschain/CrossChainStrategyHelper.sol:107,147,189). Absent in Branch B (no contracts/contracts/strategies/crosschain/*).
- Vault mint API: Branch A uses mint(asset, amount, minOusd) with multi-asset checks (contracts/contracts/vault/VaultCore.sol:61,80). Branch B adds mint(amount) for single-asset and keeps a deprecated mint(asset, amount, min) overload (contracts/contracts/vault/VaultCore.sol:53,65).

## Critical assumptions (explicit)
- Cross-chain message integrity and delivery rely on CCTP MessageTransmitter and TokenMessenger (AbstractCCTPIntegrator.onlyCCTPMessageTransmitter and _sendTokens, contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:115,359).
- Message relay is permissioned to a single operator role (AbstractCCTPIntegrator.relay, contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:433).
- Peer strategy address and domain must match on both chains, or messages will be rejected (AbstractCCTPIntegrator._handleReceivedMessage, contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338).
- Vault accounting uses strategy checkBalance outputs; for cross-chain, that includes cached remote and pending amounts (CrossChainMasterStrategy.checkBalance, contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:141).

UNKNOWN: Any cross-chain deployment state for Branch B (no crosschain contracts found; expected contracts/contracts/strategies/crosschain/*).
