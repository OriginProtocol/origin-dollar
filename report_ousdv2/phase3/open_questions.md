# Open Questions (Phase 3)

1) Bridge/messaging stack for OUSD representations
- UNKNOWN: Phase 2 only documents CCTP for USDC strategy flows, not OUSD bridging (report_ousdv2/summary/executive_summary.md; report_ousdv2/branches/branch_A/flows.md).
- Needed: decision on bridge/messenger and its security properties.

2) Bridged OUSD rebase semantics
- UNKNOWN: Whether bridged OUSD should mirror rebases in real time or via periodic sync.
- Needed: design choice and data flow for rebase propagation.

3) Multi-chain governance scope
- UNKNOWN: Whether governance actions need to execute on destination chains or only mainnet.
- Needed: governance model for bridge adapters and lockbox contracts.

4) Operational cadence for balance reporting
- UNKNOWN: Required reporting frequency for remote balances and reconciliation (Phase 2 uses sendBalanceUpdate and cached balances) (report_ousdv2/branches/branch_A/flows.md; contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:360-368).

5) Liquidity incentive budget and target chains
- UNKNOWN: Chains and incentive budgets are not specified in Phase 2 docs.

6) Option 5 rebase sync mechanism
- UNKNOWN: Cross-chain rebase propagation contract and message format are not defined; no existing implementation found.
- Needed: explicit design for rebase updates from Ethereum to spokes, including replay protection and ordering.

7) Option 5 AMO availability on Base/SEI for OUSD
- UNKNOWN: OUSD-specific AMO strategy contracts on Base/SEI were not found (only generic AMO patterns exist).
- Needed: confirm whether to reuse existing AMO patterns or build new OUSD AMO strategies.

8) Base to SEI routing
- UNKNOWN: Preferred cross-chain route and messenger for Base <-> SEI while keeping accounting on Ethereum.
- Needed: confirm whether transfers must always hop via Ethereum or if a hub-verified direct route is acceptable.
