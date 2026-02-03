# Branch A Overview (shah/cross-chain-strategy-cctpv2 @ 2d15f1419)

## Summary
Branch A contains the full Phase 2 cross-chain strategy stack. It pairs a mainnet master strategy with a remote strategy on another chain and uses CCTP for USDC transport plus custom message payloads for balance updates (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:17; contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:22; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:21).

## Components
- CrossChainMasterStrategy: mainnet strategy that bridges USDC and caches remote balances (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:17,29,33,141).
- CrossChainRemoteStrategy: remote-chain strategy that deposits into an ERC-4626 vault and sends balance updates (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:22,170,241,376).
- AbstractCCTPIntegrator: CCTP messaging/relay and nonce management (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:21,359,433,538,588).
- CrossChainStrategyHelper: message encoding/decoding and header parsing (contracts/contracts/strategies/crosschain/CrossChainStrategyHelper.sol:13,107,147,189,235).
- CrossChainStrategyProxy: create2 proxy used to keep the same address across chains (contracts/contracts/proxies/create2/CrossChainStrategyProxy.sol:19).
- OUSD Vault (multi-asset): allocates per-asset to default strategies and rebases supply based on strategy balances (contracts/contracts/vault/VaultAdmin.sol:111; contracts/contracts/vault/VaultCore.sol:321,369; contracts/contracts/vault/VaultStorage.sol:147).
- OUSD token: supply is adjusted on rebase (contracts/contracts/token/OUSD.sol:597).

## Deployment wiring
Mainnet and Base deploy scripts set up create2 proxies and deploy the master/remote implementations (contracts/deploy/mainnet/165_crosschain_strategy_proxies.js:4; contracts/deploy/mainnet/166_crosschain_strategy.js:9; contracts/deploy/base/040_crosschain_strategy_proxies.js:4; contracts/deploy/base/041_crosschain_strategy.js:9). CCTP domain IDs are declared in contracts/utils/cctp.js:3.
