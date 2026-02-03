# Branch B Overview (clement/simplify-ousd @ 327a6ebef)

## Summary
Branch B refactors the OUSD vault into a single-asset model with a single defaultStrategy and updated mint API. It does not include the Phase 2 cross-chain strategy contracts (expected contracts/contracts/strategies/crosschain/* are absent).

## Components
- OUSDVault: constructor wires the single asset into VaultAdmin/VaultCore (contracts/contracts/vault/OUSDVault.sol:10-11).
- VaultStorage: defines a single asset and defaultStrategy (contracts/contracts/vault/VaultStorage.sol:202,213).
- VaultCore: mints using a single asset, allocates to defaultStrategy, and rebases from _checkBalance(asset) (contracts/contracts/vault/VaultCore.sol:65,389,424,546).
- VaultAdmin: configures defaultStrategy and strategy permissions (contracts/contracts/vault/VaultAdmin.sol:90,168,180).
- OUSD token: supply adjusted on rebase via changeSupply (contracts/contracts/token/OUSD.sol:597).

## Deployment wiring
- OUSD vault upgrade deploys OUSDVault and sets defaultStrategy to the Morpho strategy (contracts/deploy/mainnet/167_ousd_vault_upgrade.js:18,51).

UNKNOWN: Cross-chain strategy components for Phase 2 (expected in contracts/contracts/strategies/crosschain/*).
