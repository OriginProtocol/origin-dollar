# Branch B Permissions Matrix

## Roles
- Governor (Governable.onlyGovernor) (contracts/contracts/governance/Governable.sol:75).
- Strategist (VaultAdmin.onlyGovernorOrStrategist) (contracts/contracts/vault/VaultAdmin.sol:28).
- Vault (no cross-chain roles present in this branch).

## VaultAdmin (single-asset)
- setDefaultStrategy -> onlyGovernorOrStrategist (contracts/contracts/vault/VaultAdmin.sol:90-105).
- approveStrategy/removeStrategy -> onlyGovernor (contracts/contracts/vault/VaultAdmin.sol:168-218).
- depositToStrategy/withdrawFromStrategy -> onlyGovernorOrStrategist (contracts/contracts/vault/VaultAdmin.sol:270-322).
- setRebaseThreshold/setAutoAllocateThreshold/setMaxSupplyDiff/setTrusteeAddress/setTrusteeFeeBps -> onlyGovernor (contracts/contracts/vault/VaultAdmin.sol:71,58,357,366,375).
- pauseRebase/unpauseRebase/pauseCapital/unpauseCapital -> onlyGovernorOrStrategist (contracts/contracts/vault/VaultAdmin.sol:388,396,404,412).
- transferToken -> onlyGovernor (contracts/contracts/vault/VaultAdmin.sol:427-433).

## VaultInitializer
- initialize(oToken) -> onlyGovernor (contracts/contracts/vault/VaultInitializer.sol:15).
