# Phase 3 Security and Risk Analysis

## Baseline (Phase 2)
- Cross-chain messaging in Phase 2 relies on CCTP with an operator relay and peer validation (report_ousdv2/summary/executive_summary.md; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338,433).
- Vault-only mint/burn is a core invariant (report_ousdv2/summary/key_invariants.md; contracts/contracts/token/OUSD.sol:414-434).

## Option-specific risks
### Option 1 (Canonical bridged OUSD)
- Bridge/lockbox compromise can create unbacked bridged supply.
- New trust boundary: chosen messaging/bridge provider.
- Control: strict lockbox accounting, caps, and reconciliation checks.

### Option 2 (Hub-and-spoke lockbox)
- Spoke vault compromise can mint unbacked supply until hub reconciliation.
- Complex reconciliation logic increases bug surface.
- Control: per-chain credit limits, rate limits, and kill switches.

### Option 3 (Burn-mint messaging)
- Adapter mint/burn authority is security-critical; compromise inflates supply.
- Messaging layer failure can strand supply or cause desync.
- Control: strict role management, rate limits, and emergency pause for adapters.

### Option 4 (Liquidity-only expansion)
- Bridge failures or LP drain on L2 harm UX and peg locally.
- Less protocol code risk, more operational/third-party dependency risk.
- Control: diversified liquidity sources and bridge health monitoring.

### Option 5 (Hub-spoke rebasing + async withdrawals)
- New trust boundary: hub credit manager and rebase sync messaging; compromise can inflate per-chain supply up to credit caps.
- Async withdrawals on spokes depend on cross-chain liquidity; outages can stall claims.
- Local AMO adds market and contract risk on each chain.
- Control: strict per-chain credit caps, single messaging stack, pause switches per chain, and continuous rebase sync monitoring (contracts/contracts/vault/VaultCore.sol:184-237; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338,538).

## Controls required (across options)
- Access control hardening for any mint/burn or bridge-adapter authority (contracts/contracts/token/OUSD.sol:414-434).
- Rate limits for cross-chain mint/burn and transfer caps.
- Circuit breakers for bridge or messenger outages (align with existing Vault pause controls) (contracts/contracts/vault/VaultAdmin.sol:388-412).

## Monitoring signals
- Bridged supply vs lockbox balances (Option 1/2).
- Per-chain supply and reconciliation lag (Option 2/3).
- Messaging success rate and relay latency (Option 1/3).
- Liquidity depth and price impact for pools (Option 4).
