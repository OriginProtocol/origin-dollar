# Migration Plan (M0/M1/M2)

## M0 - Minimal-risk pilot
- Scope: one target chain with canonical bridged OUSD representation (Option 1) and small liquidity seed.
- Preserve Phase 2 accounting: no change to Vault rebase or OUSD mint/burn (report_ousdv2/summary/key_invariants.md; contracts/contracts/token/OUSD.sol:414-434).
- Gate: cap total bridged supply via lockbox limits; manual approval to increase.
- Kill switches: use Vault pauseCapital/pauseRebase for emergency containment (contracts/contracts/vault/VaultAdmin.sol:388-412).

## M1 - Expansion and automation
- Add additional chains after successful M0 monitoring.
- Automate liquidity provisioning and monitoring, but keep bridge caps and reconciliation alerts.
- Add reporting dashboards for bridge supply vs lockbox balance.

## M2 - Scale and hardening
- Formal incident runbooks (bridge outage, depeg, liquidity drain).
- Independent monitoring and alerting across chains.
- Optional: integrate cross-chain UX improvements (faster relays, aggregated routing).

## Testnet/devnet plan
- Testnet deployment of lockbox and bridged token.
- Simulate message failures and reconcile supply mismatches.

## Rollout gates
- Pre-launch audits and invariant tests for lockbox accounting.
- Post-launch: daily reconciliation checks and on-chain supply audits.

## Backward compatibility and upgrade plan
- Keep Vault and OUSD token interfaces stable; add new contracts to avoid modifying core invariants (report_ousdv2/summary/key_invariants.md).
- If new permissions are required, they must be gated by governance processes (report_ousdv2/branches/branch_A/permissions.md; report_ousdv2/branches/branch_B/permissions.md).
