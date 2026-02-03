# Option Comparison Matrix

Scores: 1 (worst) to 5 (best). Security and simplicity are weighted higher.

| Option | Security | Accounting complexity | Cross-chain dependency risk | UX | Liquidity fragmentation risk | Implementation effort | Operational burden | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1) Canonical bridged OUSD | 4 | 3 | 3 | 3 | 3 | 3 | 3 | Maintains mainnet supply; adds bridge trust. |
| 2) Hub-and-spoke lockbox | 2 | 1 | 2 | 4 | 2 | 1 | 1 | High complexity; multiple trust points. |
| 3) Burn-mint messaging | 2 | 2 | 2 | 4 | 2 | 2 | 2 | New messaging + adapter mint/burn authority. |
| 4) Liquidity-only expansion | 5 | 5 | 3 | 2 | 4 | 4 | 3 | Minimal protocol changes; depends on external bridges/LP ops. |
| 5) Hub-spoke rebasing + async withdrawals | 3 | 2 | 2 | 4 | 2 | 2 | 2 | Local mint/withdraw improves UX but adds credit + rebase sync complexity. |

Justifications (short):
- Option 1: Preserves Phase 2 canonical accounting but introduces bridge trust (report_ousdv2/summary/key_invariants.md).
- Option 2: Adds per-chain minting and reconciliation overhead, increasing complexity and blast radius (report_ousdv2/reconciliation/reconciliation_report.md).
- Option 3: Requires mint/burn permissions beyond Vault (contracts/contracts/token/OUSD.sol:414-434) and a new messaging trust boundary.
- Option 4: Keeps Phase 2 constraints intact but provides weaker UX and relies on external liquidity operations.
- Option 5: Adds per-chain mint and async withdrawals with hub credit + rebase sync, increasing cross-chain dependencies (contracts/contracts/vault/VaultCore.sol:184-237; report_ousdv2/summary/executive_summary.md).
