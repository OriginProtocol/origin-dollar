# Foundry Migration — Open Questions & Batch Plan

> Companion to [foundry-migration-gap-analysis.md](./foundry-migration-gap-analysis.md) and
> [hardhat-test-inventory.md](./hardhat-test-inventory.md). Tracks which documented Hardhat→Foundry
> test gaps are being implemented now vs. which need a decision (or fixture work) before they can be.
> Started 2026-07-20.

The gap analysis lists ~430 Hardhat test/assertions with no (or partial) Foundry equivalent. Most are
blocked on a decision (a chain not configured in `foundry.toml`, off-chain JS suites that cannot run in
`forge`, or deprecated/undeployed contracts) or need non-trivial fixture work. A focused, unambiguous
set has been implemented directly (Batch 1).

Only `mainnet`, `base`, `arbitrum`, `hyperevm` have fork endpoints in `foundry.toml` — **`sonic` and
`plume` are not configured**, so anything needing those forks is blocked.

## Batch 1 — implemented (2026-07-20)

18 tests added against existing Foundry infrastructure on configured fork chains, all passing (full
unit suite green, no regressions):

- **WOETH** `redeem(0)` / `withdraw(0)` — `tests/unit/token/WOETH/concrete/{Redeem,Withdraw}.t.sol`
- **CompoundingStakingSSV** initial-deposit config: getter defaults to 1 ETH, `setInitialDepositAmount`
  happy-path + event, non-governor revert, `< 1 ether` revert, `> 2048 ether` revert —
  `tests/unit/strategies/CompoundingStakingSSVStrategy/concrete/Configuration.t.sol`
- **OUSDVault** exact `1e9` tiny trustee fee (existing test's `1e12` tolerance was vacuous) —
  `tests/unit/vault/OUSDVault/concrete/Rebase.t.sol`
- **Merkl pool-booster** 4 unauthorized-caller setter reverts (`setCampaignType`/`setRewardToken`/
  `setMerklDistributor`/`setCampaignData`) — `tests/unit/poolBooster/Merkl/concrete/PoolBoosterMerkl_Config.t.sol`
- **OUSD/OETH Curve AMO + MorphoV2** smoke: `governor() == Timelock` (fixes the circular fixture read),
  Curve reward-token `== CRV`, MorphoV2 `harvesterAddress` set —
  `tests/smoke/mainnet/strategies/{OUSDCurveAMOStrategy,OETHCurveAMOStrategy,MorphoV2Strategy}/concrete/ViewFunctions.t.sol`

## A. Open questions — need a decision before implementing

Fill in the **Answer** column (or reply in the PR/thread).

| # | Item | Area(s) | ~Gaps | Blocker | Decision needed | Answer |
|---|------|---------|-------|---------|-----------------|--------|
| 1 | Plume / OETHP vault + token | vault-multichain, token-wrapped | ~9 | OETHP winding down; no `plume` fork endpoint | Skip Plume (recommended), or add a `plume` endpoint + port? | |
| 2 | Sonic (OSVault auth, wOS config, SwapX yield) | vault-general, token-wrapped | ~7 | No `sonic` endpoint in `foundry.toml` | Add `sonic = "${SONIC_PROVIDER_URL}"` so these can be ported, or skip? | |
| 3 | OUSD Rebalancer suite | rebalancer | 109 | Off-chain JS + GraphQL (`utils/rebalancer.js`) — not Solidity, can't run in forge | Re-home as a standalone JS runner (mocha/vitest), or accept loss once Hardhat CI is gone? | |
| 4 | decode-origin-nonce | crosschain | ~5 | Off-chain JS decoder (`tasks/crossChain.js`) | Same as #3 — JS runner or drop? | |
| 5 | Algebra / Hydrex AMO (`StableSwapAMMStrategy`) | strat-algebra-amo | 69 | Contract exists but **not deployed anywhere**; Hydrex was withdrawn; the Sonic SwapX variant is already covered | Deprecated (skip), or coming to Base (unit tests now, fork later)? | |
| 6 | Legacy `NativeStakingSSVStrategy` | strat-native-ssv | 42 | Legacy strategy, superseded by `CompoundingStakingSSVStrategy` (already unit-tested) | Port the legacy suite, or retire it (skip / minimal smoke only)? | |
| 7 | `RebalancerModule` full unit suite | safe-modules | 46 | Contract exists, **not yet deployed**; unit-testable now (like `AutoWithdrawalModule`) | Implement the full unit suite now? (No hard blocker — confirm priority given it's not deployed.) | |
| 8 | Base `SuperOETHHarvester` | vault-multichain | ~7 (+8 retired `it.skip`) | No Foundry harvester test infra; the `harvestAndSwap` cases are retired | Build harvester infra (whitelist / dripper / `harvestAndTransfer`)? Confirm the retired `harvestAndSwap` `it.skip` cases are dropped. | |
| 9 | Base/HyperEVM Timelock governance | zapper-gov-hacks | 2 | `GovHelper` implements only the mainnet GovernorSix flow | Extend `GovHelper` for `TimelockController` (Base + HyperEVM), or defer? | |
| 10 | Legacy OUSD migration-state tests (altCPT ≠ 1e18) | token-ousd | ~4 | Require `vm.store`-forging legacy account state | Implement with state-forging, or defer? | |
| 11 | Whale `withdrawAllFromStrategies` on real strategies | vault-oeth, vault-general | 3 | Heavy fork test that unwinds real deployed mainnet strategies via the timelock | Implement the heavy end-to-end fork test, or defer? | |
| 12 | 21-validator real-proof SSV scenarios | strat-compounding-ssv | ~8 | Need multi-validator beacon-proof fixtures | Port the heavy proof-fixture tests, or defer (unit config already covered in Batch 1)? | |
| 13 | WOETH-upgrade / EigenLayer / EIP-7702 live-state | token-wrapped | ~4 | Block-pinning + niche live states; some were already `it.skip` | Implement (pin blocks), or defer? | |

## B. Deferred from Batch 1 — need fixture work (no external decision, just effort)

These were originally scoped for Batch 1 but turned out to need real fixtures / deeper work rather than
being mechanical. No decision needed — they'll be picked up in a follow-up unless deprioritized.

| Item | Area | Why deferred |
|------|------|--------------|
| Beacon exact SSZ roots + `0x01` validator vector | beacon | Need byte-exact input vectors / a real valid proof from the Hardhat fixtures to reproduce the known constants (`0x5b449f…`, `0xc27ca5…`); the current tests only assert `!= bytes32(0)` |
| Curve AMO front-running strengthen | strat-curve-amo-mainnet | Needs deep reading of the existing fork test + exact protocol-profit accounting (`Δ totalValue − Δ totalSupply`), plus the OUSD/USDC 6-decimal variant |
| Base AMO exact params (`allowedWethShareInterval`, harvester) | strat-base-amo | Exact values are governance-tunable — need on-chain confirmation before asserting |
| token-ousd account-type transfers/mints | token-ousd | Need a multi-account-type fixture (rebasing / non-rebasing / delegation-target) |
| strat-behaviour `setHarvester` / `setRewardTokens` | strat-behaviour-misc | Hardhat runs these across *all* strategies — needs a call: one representative test vs. a shared Foundry behaviour harness |

> Also intentionally skipped in Batch 1: exact `maxSlippage` / coin-index assertions on the Curve AMOs
> (governance-tunable), keeping only the stable `governor` / reward-token assertions.
