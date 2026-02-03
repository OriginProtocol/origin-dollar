# Option 2: Hub-and-Spoke Lockbox (per-chain mint/burn with hub accounting)

## A) Description
Introduce per-chain OUSD mint/burn via local vaults, but require each chain's minting to be backed by hub-managed credits. The hub (mainnet Vault) remains the accounting source of truth and reconciles net supply across spokes using periodic balance reports, similar to Phase 2's remote balance reporting (report_ousdv2/branches/branch_A/flows.md).

## B) Changes vs Phase 2
- Adds per-chain mint/burn flows (not present in Phase 2), while preserving mainnet rebase as the canonical accounting engine (report_ousdv2/summary/key_invariants.md).
- Requires a new cross-chain credit system to authorize minting on spokes; Phase 2 only reports balances for strategy accounting (report_ousdv2/branches/branch_A/flows.md).

## C) Trust assumptions + threat model delta
- New trust assumption: spoke vaults and credit limiters enforce mint caps correctly.
- New cross-chain reporting oracle (balances/credits) becomes security-critical.
- Blast radius increases: a compromised spoke could inflate local supply until hub reconciliation catches up.

## D) Accounting model
- Hub accounting: mainnet vault records per-chain outstanding supply and enforces global backing (new state).
- Spoke accounting: local mint/burn constrained by hub-issued credit; reports net changes to hub.
- Hub rebase remains the only driver of global OUSD supply changes (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:424-468).

## E) Liquidity + distribution plan
- Each spoke can mint OUSD locally within credit limits, enabling deeper liquidity.
- Incentives can be distributed per-chain to build local depth.

## F) UX
- Users can mint/redeem on local chains (improved UX), but bridge finality may affect credit availability.
- Fees and latency depend on cross-chain credit updates.

## G) Operational load
- Requires a robust reporting cadence and credit management; more complex than Phase 2's single operator (report_ousdv2/summary/executive_summary.md).
- Incident response must include credit freezes per chain.

## H) Blast radius analysis
- Spoke compromise can create unbacked local supply until hub detects and clamps credit.
- Hub compromise affects all spokes.

## I) Implementation sketch
- New contracts: HubCreditManager (mainnet), SpokeVault (per chain), CreditReporter.
- Reuse Phase 2 message handling patterns (AbstractCCTPIntegrator-style nonce and peer checks) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338,538).
- Requires changes to allow per-chain mint/burn beyond mainnet Vault (OUSD mint/burn currently onlyVault) (contracts/contracts/token/OUSD.sol:414-434).

## J) Tests/monitoring requirements
- Credit invariants: total spoke minted <= hub credit; reconcile supply vs backing.
- Failure tests: delayed reports, incorrect credit updates, spoke downtime.
- Monitoring: per-chain credit usage, reconciliation lag, and hub-spoke divergence.
