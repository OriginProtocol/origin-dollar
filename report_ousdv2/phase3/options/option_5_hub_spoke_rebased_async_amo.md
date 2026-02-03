# Option 5: Hub-Spoke Rebasing Vaults with Async Withdrawals + AMO (Ethereum hub)

## A) Description
Enable mint and async withdrawals on every chain via spoke vaults, while keeping the canonical accounting and rebase on Ethereum. Spoke vaults either forward USDC to the Ethereum vault for strategy deployment (e.g., Morpho) or deposit into local AMO liquidity strategies. Rebase state is propagated from Ethereum to spokes so the token remains rebasing across chains. Base to SEI transfer routes through the Ethereum hub to preserve accounting on Ethereum.

## B) Changes vs Phase 2
- Add spoke vaults that implement local mint + async withdrawal queues (pattern exists on mainnet via VaultCore.requestWithdrawal/claimWithdrawal) (contracts/contracts/vault/VaultCore.sol:184-237).
- Add hub-side credit accounting to cap minting per chain; Phase 2 only tracks remote strategy balances and pending amounts (report_ousdv2/summary/executive_summary.md; contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:29,33,141).
- Add a cross-chain rebase sync path to update rebasing token state on spokes; Phase 2 has no such mechanism (report_ousdv2/summary/executive_summary.md; UNKNOWN: no cross-chain rebase sync contracts found).
- Keep strategy deposits restricted to the Ethereum vault (Morpho strategies are onlyVault) (contracts/contracts/strategies/MorphoAaveStrategy.sol:108-112; contracts/contracts/vault/VaultAdmin.sol:270-304).
- Introduce optional local AMO strategies on spokes; AMO strategy patterns exist in repo (e.g., AerodromeAMOStrategy) but are not OUSD-specific (contracts/contracts/strategies/aerodrome/AerodromeAMOStrategy.sol:22; UNKNOWN: OUSD AMO strategy for Base/SEI not found).

## C) Trust assumptions + threat model delta
- New trust boundary: spoke vaults and hub credit manager must enforce mint caps and withdrawal limits.
- Cross-chain messaging becomes security-critical for rebase sync and credit updates (Phase 2 uses a single operator relay and peer validation) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338,433).
- Local AMO on a spoke adds market and smart contract risk on that chain; hub accounting should limit blast radius with credit caps.

## D) Accounting model
- Ethereum vault remains the accounting source of truth; OUSD supply changes only via Vault rebase on Ethereum (report_ousdv2/summary/key_invariants.md; contracts/contracts/vault/VaultCore.sol:424-468; contracts/contracts/token/OUSD.sol:597).
- Hub tracks per-chain minted supply and pending withdrawals (new hub credit ledger). Spoke minting is limited by hub-issued credits.
- Rebase is computed on Ethereum and propagated to spokes via a rebase sync message; spokes update local rebasing token state accordingly (NEW; UNKNOWN: rebase sync contract design).
- Yield forwarding: spoke AMO/strategies either bridge USDC back to Ethereum or report balances to the hub using a Phase 2-style message path (report_ousdv2/branches/branch_A/flows.md; contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:360-368).

## E) Liquidity + distribution plan
- Use local AMO strategies to provide deep liquidity on each spoke (pattern exists, not OUSD-specific) (contracts/contracts/strategies/aerodrome/AerodromeAMOStrategy.sol:22).
- If a chain has no AMO, spoke vault forwards USDC to Ethereum for deployment into strategies (Morpho) (contracts/contracts/strategies/MorphoAaveStrategy.sol:108-112).

## F) UX
- Users can mint and request async withdrawals locally; claims are fulfilled once local liquidity or bridged funds are available (VaultCore async withdrawal pattern) (contracts/contracts/vault/VaultCore.sol:184-237).
- Base to SEI transfers route through the Ethereum hub (Base -> Ethereum -> SEI) to preserve accounting on Ethereum (NEW design requirement).
- Latency depends on cross-chain messaging and liquidity on the destination chain.

## G) Operational load
- Keepers/relayers for: (1) credit updates, (2) rebase sync messages, and (3) bridging USDC for withdrawal liquidity.
- Simplicity goal: single messaging stack and strict per-chain credit caps to reduce operational risk.

## H) Blast radius analysis
- Spoke vault compromise can inflate supply only up to the hub-issued credit cap; hub accounting and caps bound losses.
- Bridge/messenger outage stalls rebase sync and async withdrawal fulfillment on that chain but does not alter Ethereum accounting.
- AMO failure on a spoke impacts local liquidity; hub should reduce credit or pause that chain.

## I) Implementation sketch
- New contracts:
  - HubCreditManager (Ethereum): tracks per-chain credit, minted supply, pending withdrawals.
  - SpokeVault (Base, SEI, etc.): local mint and async withdrawals; enforces hub credit limits.
  - SpokeRebasingOUSD (per chain): rebasing token that accepts rebase updates from Ethereum.
  - RebaseSyncer + CreditReporter: cross-chain messaging contracts (reuse AbstractCCTPIntegrator patterns for peer validation and nonces) (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338,538).
  - SpokeAMO (optional): local AMO strategy; can follow existing AMO patterns (contracts/contracts/strategies/aerodrome/AerodromeAMOStrategy.sol:22).
- Reuse Ethereum vault and Morpho strategies as-is; only Ethereum vault deposits to Morpho (contracts/contracts/strategies/MorphoAaveStrategy.sol:108-112).

## J) Tests/monitoring requirements
- Credit invariants: total minted per chain <= hub credit; hub sum of credits <= backing.
- Rebase sync: rebase state on spokes matches Ethereum after each sync message.
- Async withdrawal queue: request/claim ordering and liquidity shortfall paths (contracts/contracts/vault/VaultCore.sol:184-237).
- Messaging security: peer domain and peer contract validation, replay protection (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:338,538).
- Monitoring: per-chain credit utilization, rebase sync lag, and AMO liquidity health.

## Validity notes (security-focused)
- This option meets the requirement for local mint and async withdrawals, but it is materially more complex than Option 1 and introduces multiple new trust boundaries. To keep it "super simple and security-focused," the design should enforce tight credit caps, a single messaging stack, and minimal per-chain contract surface.
- UNKNOWN: OUSD-specific AMO contracts on Base/SEI were not found. If AMO is required, new OUSD AMO strategies must be built and reviewed.
