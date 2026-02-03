# Contracts to Modify

## Minimal changes for Option 1
- Deployment scripts: add lockbox/bridged token deployments and governance actions, analogous to Phase 2 deploy scripts (report_ousdv2/branches/branch_A/overview.md; contracts/deploy/mainnet/165_crosschain_strategy_proxies.js:4).
- Governance scripts: add actions to configure bridge caps and addresses (new code).

## Potential changes for other options
- OUSD token mint/burn permissions (Option 3): currently onlyVault (contracts/contracts/token/OUSD.sol:414-434).
- Vault interfaces for per-chain credit management (Option 2): would extend VaultAdmin/VaultCore logic (report_ousdv2/reconciliation/reconciliation_report.md).

Note: Recommendation is to avoid modifying core Vault/OUSD logic unless required by the chosen option (report_ousdv2/summary/key_invariants.md).
