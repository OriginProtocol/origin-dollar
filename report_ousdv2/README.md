# Phase 2 (OUSD v2) Multichain Yield Distribution Report

## What this report is
This report documents the Phase 2 multichain yield distribution design for OUSD as it exists across two unmerged branches. It is a code-backed, human-readable map intended for engineers, reviewers, and auditors.

## How it was generated
- Branch A: shah/cross-chain-strategy-cctpv2 @ 2d15f1419
- Branch B: clement/simplify-ousd @ 327a6ebef
- Build system: Hardhat in contracts/ (see contracts/package.json scripts, e.g., hardhat compile).

Compilation attempts:
- Branch A: cd contracts && pnpm hardhat compile (succeeded with warnings).
- Branch B: cd contracts && pnpm hardhat compile (succeeded with warnings).

## How to read it
- Start with the executive summary and invariants in summary/.
- Then read per-branch reports in branches/ (Phase 2 is split across the two branches).
- Finish with the reconciliation report and merge notes.

## Quick links
- Summary
  - summary/executive_summary.md
  - summary/key_invariants.md
  - summary/open_questions.md
- Branch A
  - branches/branch_A/overview.md
  - branches/branch_A/contracts.md
  - branches/branch_A/permissions.md
  - branches/branch_A/flows.md
- Branch B
  - branches/branch_B/overview.md
  - branches/branch_B/contracts.md
  - branches/branch_B/permissions.md
  - branches/branch_B/flows.md
- Reconciliation
  - reconciliation/reconciliation_report.md
  - reconciliation/merge_notes.md
- Security
  - security/risk_register.md
  - security/trust_boundaries.md
- Appendix
  - appendix/glossary.md
  - appendix/references.md
