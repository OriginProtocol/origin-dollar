# Option 3: Burn-Mint Messaging (OFT-like semantics)

## A) Description
Adopt a burn/mint cross-chain model where OUSD is burned on the source chain and minted on the destination chain via a messaging layer (OFT-style). The repo already includes Omnichain adapters built for LayerZero (OmnichainMainnetAdapter and OmnichainL2Adapter), which can be repurposed or extended (contracts/contracts/bridges/OmnichainMainnetAdapter.sol:18; contracts/contracts/bridges/OmnichainL2Adapter.sol:20).

## B) Changes vs Phase 2
- Introduces a new messaging protocol (LayerZero adapters) for OUSD movement; Phase 2 only uses CCTP for USDC and operator relay for strategy accounting (report_ousdv2/summary/executive_summary.md).
- Requires mint/burn permissions beyond the mainnet Vault because OUSD mint/burn is onlyVault (contracts/contracts/token/OUSD.sol:414-434).

## C) Trust assumptions + threat model delta
- New trust boundary: LayerZero endpoint and adapter contracts.
- Adapter mint/burn authority becomes security-critical; a compromise can inflate supply.
- Blast radius: cross-chain messaging failure can strand supply on a chain and break UX.

## D) Accounting model
- Global supply is conserved via burn/mint across chains, but accounting is distributed.
- Mainnet Vault rebase remains the only supply adjustment path (report_ousdv2/summary/key_invariants.md), but the token supply exists across multiple chains.

## E) Liquidity + distribution plan
- Native OUSD exists on each chain via mint/burn; liquidity can be bootstrapped without lockbox escrow.
- Incentive programs can be deployed per chain.

## F) UX
- Fast cross-chain transfers (subject to messaging protocol), no lockbox redemption.
- Users can move OUSD across chains without interacting with mainnet.

## G) Operational load
- Requires monitoring of messaging protocol health and adapter permissions.
- Incident response includes pausing adapter mint/burn or revoking roles.

## H) Blast radius analysis
- Messaging compromise or adapter bug can create unbacked supply.
- Vault rebase still governs total supply changes, but distribution across chains could desync if messaging fails.

## I) Implementation sketch
- Reuse or extend OmnichainMainnetAdapter and OmnichainL2Adapter (contracts/contracts/bridges/OmnichainMainnetAdapter.sol:18; contracts/contracts/bridges/OmnichainL2Adapter.sol:20).
- Modify OUSD token to allow adapter mint/burn (OUSD mint/burn currently onlyVault) (contracts/contracts/token/OUSD.sol:414-434).
- Add access control and rate limits on adapter mint/burn.

## J) Tests/monitoring requirements
- Cross-chain supply conservation tests.
- Adapter permission tests; replay protection.
- Monitoring: per-chain supply totals and messaging success rates.
