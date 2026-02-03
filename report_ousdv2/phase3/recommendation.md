# Recommendation

## Primary: Option 1 (Canonical bridged OUSD)
This option best aligns with Phase 2 constraints: the mainnet Vault remains the source of truth for supply changes (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:424-468) and OUSD mint/burn stays restricted to the Vault (contracts/contracts/token/OUSD.sol:414-434). It introduces a new bridge boundary but avoids per-chain supply accounting and preserves the canonical rebase model used in Phase 2 (report_ousdv2/phase3/phase2_constraints.md).

## Fallback: Option 4 (Liquidity-only expansion)
If bridge risk or integration effort is too high, liquidity-only expansion minimizes protocol changes while keeping all Phase 2 invariants intact (report_ousdv2/summary/key_invariants.md). It does not introduce new mint paths and thus preserves the Vault-only mint/burn restriction (contracts/contracts/token/OUSD.sol:414-434).

## Why not the others
- Option 2 (Hub-and-spoke lockbox): violates the Phase 2 simplicity and canonical accounting model by introducing per-chain mint paths and credit reconciliation (report_ousdv2/reconciliation/reconciliation_report.md; report_ousdv2/phase3/phase2_constraints.md).
- Option 3 (Burn-mint messaging): requires granting mint/burn authority beyond the Vault, which breaks a core Phase 2 invariant (contracts/contracts/token/OUSD.sol:414-434).
- Option 5 (Hub-spoke rebasing + async withdrawals): meets local mint/withdraw goals but adds hub credit + rebase sync complexity and new trust boundaries beyond Phase 2 (contracts/contracts/vault/VaultCore.sol:184-237; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338,433).
