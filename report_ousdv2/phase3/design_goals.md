# Phase 3 Design Goals and Non-Goals

## Goals
1) Preserve mainnet accounting safety: OUSD supply adjustments must remain tied to Vault rebase and strategy checkBalance (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:424-468).
2) Minimize new trust assumptions (operator, bridge, messenger), preferring existing Phase 2 trust boundaries where possible (report_ousdv2/security/trust_boundaries.md).
3) Operational simplicity: avoid per-chain manual reconciliation where possible; keep a single operational runbook (report_ousdv2/summary/executive_summary.md).
4) Expand OUSD availability on multiple chains with consistent user experience (new goal; no Phase 2 constraints).
5) Build liquidity depth on target chains without fragmenting supply accounting (report_ousdv2/reconciliation/reconciliation_report.md for single vs multi-asset differences).

## Non-goals
- No independent per-chain accounting that bypasses mainnet rebase logic unless explicitly designed and reconciled (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:424-468).
- No new mint/burn paths that bypass the Vault's onlyVault restrictions without a governance-approved design change (contracts/contracts/token/OUSD.sol:414-434).
- No reliance on unsafe or unaudited cross-chain messaging without explicit trust boundary documentation (report_ousdv2/security/trust_boundaries.md).

## Success metrics (proposed)
- Security: zero critical incidents or accounting mismatches; successful incident drills per quarter.
- Coverage: X target chains supported with OUSD liquidity and redemption UX.
- UX: median bridge/mint latency under Y minutes; predictable fees.
- Operational burden: automated reconciliation; manual interventions below Z per month.

## Constraints referenced from Phase 2
- Mainnet Vault rebase is the only supply adjustment mechanism (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:424-468).
- OUSD mint/burn restricted to Vault (contracts/contracts/token/OUSD.sol:414-434).
