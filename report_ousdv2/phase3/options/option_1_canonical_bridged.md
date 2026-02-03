# Option 1: Canonical Bridged OUSD (single supply on mainnet; bridged representations)

## A) Description
Keep the canonical OUSD supply on mainnet (Vault rebase remains the only supply adjustment), and introduce bridged OUSD representations on target chains that are minted/burned by a canonical bridge or lockbox. This aligns with the Phase 2 accounting model where mainnet vault accounting is the source of truth (report_ousdv2/phase3/phase2_constraints.md; report_ousdv2/summary/key_invariants.md).

## B) Changes vs Phase 2
- Adds a bridge/lockbox system to move OUSD across chains; Phase 2 only bridges USDC via CCTP for strategy deployment (report_ousdv2/branches/branch_A/flows.md).
- No change to core rebase logic; supply remains updated via Vault rebase (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:424-468).

## C) Trust assumptions + threat model delta
- New trust boundary: canonical OUSD bridge/lockbox must correctly mint/burn representations and enforce 1:1 backing.
- Cross-chain messenger risk introduced for OUSD representation (not present in Phase 2, which only uses CCTP for USDC) (report_ousdv2/summary/executive_summary.md).
- Blast radius: bridge compromise affects OUSD on destination chain but mainnet supply remains canonical.

## D) Accounting model
- Mainnet Vault remains the source of truth; OUSD supply changes only via rebase (report_ousdv2/summary/key_invariants.md; contracts/contracts/token/OUSD.sol:597).
- Bridged OUSD supply on L2 is backed by locked mainnet OUSD (new lockbox contract). No local rebase; bridged token mirrors mainnet supply via bridge sync or share price.

## E) Liquidity + distribution plan
- Seed liquidity on L2 using bridged OUSD + paired assets; incentives can be distributed on L2.
- Mainnet remains the primary mint/redeem venue; L2 liquidity focuses on swaps and integrations.

## F) UX
- Mint/redeem on mainnet; bridge to L2 for usage.
- Latency/fees depend on chosen bridge; Phase 2 does not currently bridge OUSD (report_ousdv2/branches/branch_A/flows.md).

## G) Operational load
- Operate bridge infrastructure and monitoring; no changes to Phase 2 operator for USDC strategy messaging.
- Requires on-chain accounting monitoring for lockbox balances.

## H) Blast radius analysis
- Bridge failure: L2 OUSD may become illiquid or de-pegged; mainnet supply remains intact.
- Lockbox bug: could inflate L2 supply without backing.

## I) Implementation sketch
- New contracts: OUSDLockbox (mainnet) + BridgedOUSD token (L2) + bridge adapter/messenger.
- Reuse Phase 2 Vault + rebase pipeline unchanged (contracts/contracts/vault/VaultCore.sol:424-468).
- Keep OUSD mint/burn restricted to Vault; lockbox holds OUSD rather than minting it (contracts/contracts/token/OUSD.sol:414-434).

## J) Tests/monitoring requirements
- Lockbox invariants: total bridged supply == locked OUSD.
- Bridge message integrity tests and replay protection.
- Monitoring: L2 bridged supply vs mainnet lockbox balance; alert on divergence.
