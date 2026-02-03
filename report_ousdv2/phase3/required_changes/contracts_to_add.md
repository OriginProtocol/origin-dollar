# Contracts to Add

## Core (recommended Option 1)
1) OUSDLockbox (mainnet)
- Purpose: hold canonical OUSD and mint/burn bridged representations on destination chains.
- Justification: OUSD mint/burn is onlyVault, so lockbox should escrow OUSD rather than mint it (contracts/contracts/token/OUSD.sol:414-434).

2) BridgedOUSD (per destination chain)
- Purpose: ERC-20 representation minted/burned by the lockbox/bridge.
- Must enforce 1:1 backing to lockbox balances.

3) BridgeAdapter (per destination chain)
- Purpose: interface to chosen messaging/bridge layer; must enforce replay protection.

## Optional (if hub-and-spoke or burn-mint options are chosen)
- HubCreditManager / SpokeVault / CreditReporter for Option 2.
- Adapter mint/burn permission contracts for Option 3 (requires OUSD mint/burn authority changes).

## Option 5 additions (hub-spoke rebasing + async withdrawals)
- SpokeRebasingOUSD (per chain) to receive rebase updates from Ethereum (NEW).
- RebaseSyncer contracts for cross-chain rebase propagation (NEW).
- Spoke AMO strategy contracts if local liquidity is required (UNKNOWN: OUSD-specific AMO not found).

References: Phase 2 relies on Vault-only mint/burn and mainnet canonical accounting (report_ousdv2/summary/key_invariants.md; contracts/contracts/token/OUSD.sol:414-434).
