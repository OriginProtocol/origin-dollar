# Option 4: Liquidity-Only Expansion (no new mint path)

## A) Description
Keep canonical OUSD mint/redeem on mainnet only and expand cross-chain presence by provisioning liquidity on target chains. This option does **not** add a new protocol mint path on L2s; it focuses on bridging existing OUSD and incentivizing liquidity pools.

## B) Changes vs Phase 2
- No change to core supply accounting or mint/burn access (OUSD mint/burn remains onlyVault) (contracts/contracts/token/OUSD.sol:414-434).
- Adds off-chain or operational processes to bridge OUSD and seed liquidity on other chains (implementation details are external to Phase 2).

## C) Trust assumptions + threat model delta
- New trust boundary: external bridge or market-maker process for moving OUSD to target chains (UNKNOWN: not specified in Phase 2 code).
- Blast radius: bridge compromise affects L2 liquidity and user balances on that chain; mainnet accounting remains canonical.

## D) Accounting model
- Mainnet Vault remains the source of truth; OUSD supply changes only via rebase (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:424-468).
- L2 OUSD is a bridged representation; no local mint/redeem.

## E) Liquidity + distribution plan
- Protocol provisions OUSD liquidity on each chain, pairing against native stable/blue-chip assets.
- Incentives can be distributed to LPs on each chain while maintaining mainnet mint/redeem.

## F) UX
- Users mint/redeem on mainnet and bridge to L2 for usage.
- Latency and fees depend on external bridge; no protocol-native cross-chain mint.

## G) Operational load
- Lower on-chain complexity; higher operational burden for liquidity management.
- Requires monitoring of bridge health and pool depth.

## H) Blast radius analysis
- Liquidity depletion or bridge outage impacts L2 user experience but does not affect mainnet supply.

## I) Implementation sketch
- No changes to Phase 2 contracts required.
- Optional: governance processes to manage liquidity and incentives; external integration contracts if needed.

## J) Tests/monitoring requirements
- Liquidity health monitoring per chain.
- Bridge status monitoring and contingency plans.

UNKNOWN: Exact bridge/messenger stack; not present in Phase 2 code or docs.
