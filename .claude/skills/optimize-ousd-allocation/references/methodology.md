# Methodology — OUSD allocation optimization

The math behind the skill, the search algorithm, and the exact tool/command surface.

## 1. The objective, precisely

Let bucket `i` hold balance `bᵢ` and earn supply APY `Aᵢ(bᵢ)`, where `Aᵢ` is **decreasing** in `bᵢ` (supplying more to a Morpho market lowers utilization → lower supply rate; withdrawing raises it).

Blended OUSD APY = `Σ bᵢ Aᵢ(bᵢ) / T`, where `T = Σ bᵢ` is total AUM.

Relocation moves dollars between buckets, so **T is constant**. Therefore:

> maximizing blended APY  ≡  maximizing `TotalYield = Σ bᵢ Aᵢ(bᵢ)` (dollars/yr).

Optimize `TotalYield`. It is a single scalar, dollar-denominated, and directly comparable to a no-move baseline.

## 2. Why spot-APY comparison is not enough

Move `x` from source `S` to destination `D`. The change in total yield:

```
Δ(x) = [(b_S − x)·A_S(b_S − x) + (b_D + x)·A_D(b_D + x)]
     −  [ b_S    ·A_S(b_S)     +  b_D    ·A_D(b_D)    ]
```

Differentiating: `dΔ/dx = MargYield_D − MargYield_S`, where `MargYield_i = Aᵢ + bᵢ·Aᵢ′`.

Because `Aᵢ′ < 0`, **MargYield_i < Aᵢ (the spot rate)**. So "destination spot APY after deposit > source spot APY after withdrawal" is only a *directional* signal — it ignores the `bᵢ·Aᵢ′` term (the re-pricing of the dollars that stay put). The correct decision variable is `Δ(x)` itself, computed from balances × APYs. Always evaluate the finite `Δ$/yr`, not the rate gap.

**Optimum for a pair**: `MargYield_D = MargYield_S`. In sweep terms, the `x` that maximizes `Δ(x)`. Past that point the legs' marginal yields cross and `Δ` decreases.

## 3. The simulator gives APYs; on-chain gives balances

- `simulate_cross_chain_move(from, to, amount)` returns `withdrawal.newApy` (source spot APY after removing `amount`) and `deposit.newApy` (dest spot APY after adding `amount`), plus `currentApy` on each leg. It does **not** return balances.
- `checkBalance(USDC)` on each strategy (on-chain) gives `bᵢ`.

### ⚠️ Do NOT use the naive `(b−x)·newApy` formula on the withdrawal side

The obvious formula `Δ$/yr = (b_S − x)·newApy_S + (b_D + x)·newApy_D − baseline` is **wrong in thin / high-utilization markets**, and produces pathological results. Reason: when you withdraw supply, utilization jumps and the spot rate *spikes*, but that spike is transient — borrowers repay (or new suppliers arrive) within hours and the rate mean-reverts toward its equilibrium. Crediting the *entire remaining balance* `(b_S − x)` at the spiked `newApy_S` is fantasy income. The naive formula then rewards withdrawing more and more (the bigger the spike, the bigger the fake gain), recommending you drain the source. Observed live: pulling 600k from mainnet Morpho spiked its rate 5.22%→14.46% and the naive model claimed +$260k/yr — pure artifact.

The same reversion applies to the **deposit** side in reverse: adding supply *depresses* the dest spot rate, but it reverts *upward*. So `deposit.newApy` is a conservative (low) estimate of sustained dest yield — that direction is safe to use as a lower bound.

### Correct estimator — value every market at its 90% target-utilization rate

Model the moved dollars only, each market valued at its **sustainable rate = the rate at 90% utilization** (see §9), not the transient post-move spot:

```
Δ$/yr ≈ x · (targetRate_D − targetRate_S)
```

- `targetRate_S` (source) = the source's rate at 90% util. If the source currently sits at ~90% util, this ≈ `curApy_S`; that is why the earlier "hold source at current spot" shortcut worked for mainnet — it was already at 90.00% util. Use the true 90%-util rate when the market is off-target.
- `targetRate_D` (dest) = the dest's 90%-util rate — the **optimistic** bound (assumes borrow demand refills util to 90% after the deposit). The **conservative** bound is `deposit.newApy_D` (the depressed post-deposit spot, i.e. assume no demand refill). Report both; headline the conservative one.

This isolates the real economics and shows honest diminishing returns with a real crossover (where `targetRate_D` falls to `targetRate_S`).

Never use `withdrawal.newApy` as the source rate — it is the transient spike. Reserve full `(b−x)·newApy` accounting only for markets that are genuinely deep in the *withdrawal* direction (`withdrawal.impactBps` small, < ~15 bps for the move size).

> Deep-for-deposit ≠ deep-for-withdrawal. A MetaMorpho vault can absorb deposits cheaply yet spike hard on withdrawals if its underlying markets sit at high utilization with thin liquidity buffers. Judge each *direction* by its own `impactBps`.

## 9. Target utilization (90%) — the sustainable-rate anchor & liquidity floor

Morpho's AdaptiveCurveIRM has a **target utilization of 90%**. The rate at 90% util is the market's equilibrium: when util > 90% the IRM raises rates over time (borrowers repay → util falls back); when util < 90% it lowers them (borrowing cheapens → util rises back). Our operating policy is to run the Morpho vaults at ~90% util. This target does three jobs in the optimizer:

1. **Sustainable-rate anchor.** Value each market at its 90%-util rate (§3 estimator). A spot rate far from the 90%-util rate is a transient that will revert — do not optimize against it.
2. **Withdrawal-liquidity floor = the 9-day SLA (§5).** At 90% util, exactly 10% of a market's supply is liquid. Keeping every market ≤ 90% util guarantees a ≥10% withdrawable buffer, which *is* the fast-liquid tier the redemption SLA needs. **Constraint: never size a withdrawal past the point it drives the market above 90% util.** The 90%-util target and the SLA buffer are the same constraint.
3. **Transient detector for destinations.** Before committing to a high-APY destination, check whether that APY is a genuine 90%-util rate or an above-target-util spike that will revert. If the dest's util > 90%, discount its headline APY to its 90%-util rate.

Tools: `simulate_morpho_deposit_for_utilization` (deposit/withdrawal that brings a market to a target util → read off the 90%-util rate) and `simulate_morpho_max_withdrawal` (already respects the util cap when sizing the max safe withdrawal).

**Confirmed tooling gap (verified 2026-07-16): utilization is exposed ONLY for the Ethereum markets (oeth-usdc, wsteth-usdc).** `deposit_for_utilization` has no chain param, and the chain-aware sims (`simulate_morpho_action/max_deposit/max_withdrawal` on 8453/999) return APY only — no `utilization` field. So the 90%-util (sustainable) rate is **not directly computable for HyperEVM or Base**. Until a per-chain util/target-rate readout exists, for cross-chain markets:
- Treat the headline APY as an **upper bound**, not a bankable sustainable rate (a high cross-chain APY usually means util is above target and will revert).
- Probe sensitivity with `simulate_morpho_max_deposit(chain, 50)` — the max deposit for a 50 bps drift reveals thinness. If a small deposit (tens of $k) already moves the rate 50 bps, the market **cannot absorb size** without you collapsing the rate you're chasing.
- **Size cross-chain deposits small and stage them** (re-probe between tranches). Treat thin high-APY cross-chain markets as *satellite* allocations, not primary destinations.
- Observed: HyperEVM at ~10.5% took only **$21k to move −50 bps** and ~$33k to move +50 bps — extremely thin, ≈ our whole position is the book. Do not size it off the headline.

Residual caveat: the 90%-util rate itself drifts as borrow **demand** shifts (the adaptive part of the IRM). It is the best available sustainable estimate, not a fixed constant — prefer moves whose edge survives a plausible drift in the target rate.

## 4. Search algorithm (Phase 3 detail)

```
budget       = movable funds (Phase 1)
alloc        = live balances
best         = TotalYield(alloc)
DRY_LIMIT    = 2
MATERIAL     = $250/yr
dry = 0
while dry < DRY_LIMIT:
    rank buckets by MargYield (estimate via a small probe move, or reuse LEARNINGS sensitivity)
    for (S, D) in pairs ordered by (MargYield_D − MargYield_S) descending:
        sizes = seed_sizes(S, D, budget, LEARNINGS)   # e.g. [50k,100k,200k,400k]
        for x in sizes:
            if violates_constraints(alloc, S, D, x): continue
            simulate → Δ$/yr(x)
        x* = argmax_x Δ$/yr(x)
        if Δ$/yr(x*) > MATERIAL:
            apply move (S → D, x*); update alloc & APYs; record; dry = 0; break
    else:
        dry += 1
report best allocation
```

Refinements:
- **Seed sizes from LEARNINGS.** For a thin source (high bps/$), start small (10k–50k) — big pulls overshoot the crossover. For a deep source (mainnet), start larger (100k–400k).
- **Extend the sweep** if the best size is the largest probed and `Δ` is still rising — the peak is beyond your grid.
- **Golden-section / bisection** on `x` around the best grid point if you want a tighter peak, but grid + one refinement step is usually enough given simulator noise.
- **Materiality + move cost**: cross-chain moves cost bridge time/fees; require a larger `Δ$/yr` (e.g. ≥ $1–2k/yr) to justify a cross-chain leg, vs the $250 floor for same-chain.

## 5. Constraints in detail

### AMO floor (redemption liquidity)
Keep `AMO ≥ 0.10 · T`. The AMO is the OUSD/USDC Curve position used to service redemptions and acquisitions at peg. Treat its balance as pinned at the floor unless its own yield justifies more.

Opportunity cost to report when pinned and underyielding:
`oppCost$/yr = floor$ · max(0, morphoMarginalAPY − amoAPY)`.
Be verbose about this — it is the price of redemption safety. Propose going below 10% only if AMO is severely underyielding *and* redemption demand is demonstrably low, and flag it as a risk decision for the strategist.

### AMO yield — KNOWN DATA GAP
The MCP exposes `get_amo_pool_state` (balances, TVL, split) and `get_amo_pool_price` (spot peg), but **not** the AMO's realized APY (Curve swap fees + gauge CRV/CVX incentives). Until a yield source is wired, hold AMO at the floor and treat its APY as unknown-but-low for opportunity-cost flagging. To close the gap, wire one of:
- Curve/Convex API for the OUSD/USDC gauge reward APR + pool fee APR, or
- on-chain: gauge `inflation_rate`/`reward_data` + pool fee accrual → annualize.
Record whatever you find in LEARNINGS so the next run can use a real number.

### Vault buffer & 9-day redemption SLA
OUSD redemptions are an async queue. `get_vault_withdrawal_shortfall` returns `queued`, `claimed`, `vaultUsdcBalance`, `availableVaultBalance`, `shortfall = max(0, (queued−claimed) − vaultBalance)`.
- Hard rule: keep `shortfall == 0`.
- SLA rule: the **fast-liquid tier** (vault buffer + mainnet-Morpho withdrawable + AMO) must cover outstanding requests `(queued − claimed)` within 9 days, with a safety margin. Cross-chain balances are bridge-slow (do not count).
- Implication: there is a ceiling on how much can live on Base+HyperEVM combined. Compute it and treat it as a constraint, not just the AMO floor.

### Morpho supply caps
Each Morpho market has a cap (`get_morpho_market_stats` → `cap`, `simulate_*` → `isCapped`/`isPartial`). A deposit that would breach the cap is partial — respect the returned `withdrawableAmount`/cap headroom.

## 6. Liquidity tiers (summary)

| Tier | Buckets | Redemption speed | Role |
|---|---|---|---|
| Fast | Vault buffer, Curve AMO, mainnet Morpho | seconds–minutes | serve 9-day SLA |
| Slow | Cross-chain Morpho (Base 8453, HyperEVM 999) | hours–days (bridge) | yield only; capped by SLA |

## 7. Tool & command reference

### On-chain reads (run from `contracts/`)
```bash
RPC=$(grep -E "^PROVIDER_URL" .env | cut -d= -f2-)
VAULT=0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70
USDC=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

cast call $VAULT "getAllStrategies()(address[])" --rpc-url "$RPC"
cast call $VAULT "getAllAssets()(address[])"      --rpc-url "$RPC"
cast call $VAULT "totalValue()(uint256)"          --rpc-url "$RPC"          # 1e18
cast call <STRAT> "checkBalance(address)(uint256)" $USDC --rpc-url "$RPC"    # 1e6 (USDC)
cast call $USDC  "balanceOf(address)(uint256)" $VAULT --rpc-url "$RPC"       # 1e6, undeployed buffer
```
Map strategy addresses → names by grepping `contracts/utils/addresses.js`. Known set (rarely changes):
| Address | Name | Bucket |
|---|---|---|
| `0x3643cafA6eF3dd7Fcc2ADaD1cabf708075AFFf6e` | MorphoOUSDv2Strategy | mainnet Morpho (fast) |
| `0xB1d624fc40824683e2bFBEfd19eB208DbBE00866` | CrossChainMasterStrategy | Base Morpho, 8453 (slow) |
| `0xE0228DB13F8C4Eb00fD1e08e076b09eF5cD0EA1e` | CrossChainHyperEVMMasterStrategy | HyperEVM Morpho, 999 (slow) |
| `0x26a02ec47ACC2A3442b757F45E0A82B8e993Ce11` | CurveOUSDAMOStrategy | AMO (fast, floor) |

### MCP simulation tools (server: OUSD strategist tools)
- `get_morpho_market_stats` — mainnet Morpho market APYs/util/caps/liquidity + vault APY.
- `get_vault_withdrawal_shortfall` — redemption queue + buffer + shortfall.
- `get_amo_pool_state` / `get_amo_pool_price` — Curve OUSD/USDC pool balances, split, peg.
- `simulate_cross_chain_move(from_chain, to_chain, amount)` — post-move spot APYs on both legs. `amount` is USDC in 1e6 base units, decimal string. chains: 1=Ethereum, 8453=Base, 999=HyperEVM.
- `simulate_morpho_action(...)` / `simulate_morpho_max_withdrawal(chain_id, max_impact_bps)` / `simulate_morpho_max_deposit` — same-chain sizing and drift bounds.
- `simulate_burn_to_peg` / `simulate_burn_to_target` / `simulate_burn_amount` — AMO rebalance simulation (peg management, adjacent to but not part of yield optimization).

### Chain IDs
`1` = Ethereum mainnet · `8453` = Base · `999` = HyperEVM.

## 8. Failure modes to avoid
- Optimizing rate gaps instead of `Δ$/yr` (overstates thin-market moves).
- Trusting one simulator call — APYs drift materially between calls; re-probe and prefer robust edges.
- Forgetting the 9-day SLA and over-allocating to bridge-slow cross-chain markets.
- Churning for sub-materiality gains, or proposing a multi-day bridge for a few hundred $/yr.
- Silently dipping below the AMO floor — always surface it.
