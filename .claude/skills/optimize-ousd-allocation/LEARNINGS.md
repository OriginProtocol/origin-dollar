# LEARNINGS — OUSD allocation optimizer

The skill's memory. Each run appends a dated entry (Phase 5). Newest at top. Keep terse.
The highest-value content is **per-market sensitivity** (bps of APY move per $100k in/out) — it lets the next run seed sweep sizes without re-probing from scratch. Sensitivities are balance- and time-dependent; treat them as priors to verify, not constants.

## Market sensitivity cheat-sheet (verify each run)

| Market | Depth | Approx sensitivity | Sweep seed |
|---|---|---|---|
| Mainnet Morpho (OETH/USDC) | Deep | ~8 bps per 100k, ~17 bps per 200k withdraw | start 100k–400k |
| Base Morpho (cross-chain) | **Thin** | ~354 bps per 50k withdraw (very high, balance-dependent) | start 10k–50k |
| HyperEVM Morpho (cross-chain) | Thin–moderate | ~13 bps per 100k, up to ~105 bps per 50k at low balance | start 25k–100k |
| Curve OUSD/USDC AMO | n/a (fee+gauge) | APY source not wired yet | hold at 10% floor |

## Standing caveats
- **State drifts hard between calls.** Within a single session HyperEVM supply APY was observed at 5.57% → 6.23% → 9.12% → 9.96%, and mainnet at 4.87% → 3.95% → 4.60%. A single sim is a point estimate. Prefer moves whose edge survives the drift; re-probe before committing.
- **Base is the thinnest leg and our strategy is a large fraction of it** — pulling even 50k spikes its rate ~350 bps. Withdrawing from Base is expensive (enriches the residual stack more than the moved dollars gain). Directionally: don't source from Base; source cross-chain moves from mainnet Morpho (deep, cheap to withdraw).
- **Bridge-pending blocks deposits.** `simulate_cross_chain_move` to HyperEVM (999) has intermittently returned a "Bridge transfer to chain 999 is currently pending — deposits are blocked" warning. Check for it before proposing a HyperEVM deposit.
- **AMO yield gap unresolved** — no realized-APY source wired for the Curve AMO. Held at floor; flag opportunity cost.

## Historical data verified + decision log (session 2026-07-16)
- **Grafana `query_range` works** with the Viewer token (`references/grafana-history.md`). Confirmed populated history.
- **HyperEVM `morpho_vault_apy` 7-day range: 6.6% – 11.0%, ~8.5% mean** (6h step). So HyperEVM's *sustainable* rate sits well below its 10.8% spot spike — valuing it at ~9% (the 90%-util anchor) is well-supported by history; **never size off the 10.8% spot.** Ethereum stable ~5.2%, Base ~5.0%.
- **Decision log added** (`decisions/decision-log.jsonl` + `references/decision-log.md`): recommend → log → (execute) → review vs realized Grafana history → calibrate. Seeded with the 150k Base→HyperEVM decision; review verdict **good** (HyperEVM held ~9% post-move, didn't revert to the 6.6% low → the sustainable-rate valuation was correct).
- Skill Phases 7 (log), 8 (review/score), 9 (LEARNINGS) added.

## Grafana investigation (session 2026-07-16)
- Grafana is **Cloud Pro** (`grafana.originprotocol.com`, Cloudflare-fronted). Built-in MCP `/api/mcp` = 404 (toggle off; enabling on Cloud needs Grafana support). Server-admin pages locked.
- **All needed data is live in Prometheus** (`grafanacloud-prom`): `morpho_vault_apy{chain}` (18 series), `ousd_rebalancer_strategy_{current,target,delta}_balance{name,address}`. Detailed earnings in Postgres. See `references/grafana-history.md`.
- **Easiest history access = Grafana HTTP API + Viewer token** (datasource proxy `query_range`) — no MCP/container/snapshotter. Core recommendation needs no history anyway.
- **Production rebalancer exists** and emits current/target/delta. Its current balances matched our on-chain reads exactly (Eth $3,576,082, HyperEVM $880,538). Its live recommendation: **+150k HyperEVM Morpho, −150k OUSD Vault** — same destination our skill derived (150k→HyperEVM).
- **⚠️ DISCREPANCY to track**: production rebalancer `OUSD Vault current_balance = 150,000` but on-chain/MCP vault USDC ≈ **$17,205**. Either stale metric or buffer changed. Exactly what the independent-verify layer is for. Policy: skill computes independently, `ousd_rebalancer_*` is a cross-check target NOT a source.

## Run log

### Merge + on-chain layer (session 2026-07-16) — rebased onto the production rebalancer
- **Merged** the coworker's production-grounded rebalancer (base) with our additions: `ousdConstraints` gates (minApySpread 0.5%, min $5K / cross-chain $25K, $50K step, freeze>50%, caution 15–50%), AMO coverage (they omitted it — 15% of collateral), sustainable-rate (90%-util) correction, and this on-chain verification layer + the learning loop.
- **Coworker-skill bug logged**: their Step 1 used MCP `maxPossibleAmount` as "deployed balance." That's a withdrawal ceiling, not deployed — undercounts Ethereum ~60% ($1.31M vs true $3.576M). Ours reads `checkBalance`/`V2.totalAssets()` on-chain. Pass this back to them.
- **On-chain verification proven** (all commands in `references/onchain-verification.md`): all 3 RPCs work (mainnet/Base/HyperEVM). `Morpho.market(id)` gives real util+liquidity on any chain.
  - Mainnet OETH/USDC on-chain: **90.00% util, $919,504 liquidity** — matches MCP exactly. MCP is trustworthy *here*.
  - **HyperEVM markets (where we hold): ~91.7% util** — ABOVE 90% target. Confirms on-chain that HyperEVM's ~10.5% is a transient above-target spike, not sustainable. Closes the cross-chain util gap the MCP left open.
- **Gotchas**: `maxWithdraw`/`maxDeposit` on Morpho Vault-V2 return **0** (non-standard) — use Blue market liquidity instead. V1 MetaMorpho spreads funds across **3 markets** per chain (`withdrawQueueLength`); `withdrawQueue[0]` on HyperEVM is a tiny idle $24.8k/0%-util market — must enumerate all and weight by our position. cast's `[1.2e3]` annotations break naive parsing — use `sed -n` + `grep -oE '^[0-9]+'`.
- **Architecture**: strategy → Vault V2 → adapter → MetaMorpho V1 → Morpho Blue markets.

## Superseded run log (pre-merge skill)

### Util-queryability check (session 2026-07-16) — RESOLVES the Run-1 open item
- **Confirmed: utilization is exposed ONLY for Ethereum markets** (oeth-usdc, wsteth-usdc). `deposit_for_utilization` is Ethereum-only (no chain param); `simulate_morpho_action/max_deposit/max_withdrawal` on 8453/999 return APY only, no util field. **Cannot directly compute HyperEVM/Base 90%-util rate.** → enhancement request: per-chain util/target-rate readout for cross-chain markets.
- **Mainnet is parked AT target**: `deposit_for_utilization(oeth-usdc, 0.90)` = just $26 to hit 90.0000% util, rate 5.28%. Mainnet's 90%-util rate ≈ current rate → mainnet side of the estimator is reliable.
- **HyperEVM is extremely thin** (verified): at ~10.53%, max deposit for −50bps = **$21,390**; max withdrawal for +50bps = **$33,479**; max withdrawable ≈ **$872k ≈ our whole $880k position** (we're basically the entire book). High rate + steep curve ⇒ it's at/above 90% util; **10.5% is NOT bankable at size.**
- **REVISES Run 1**: the 300–450k mainnet→HyperEVM was oversized — a market where $21k moves 50bps can't absorb that without us collapsing the rate. Correct sizing: **$30–75k, staged, re-probe between tranches**; treat HyperEVM as a *satellite*, not a primary destination, until util is queryable. Same caution applies to Base.

### Policy update (session 2026-07-16) — 90% target utilization folded in
- We run the Morpho vaults at **~90% util** (the AdaptiveCurveIRM target). Encoded as: (1) sustainable-rate anchor — value every market at its 90%-util rate, treat deviations as transients that revert; (2) withdrawal-liquidity floor — never withdraw a market above 90% util, which preserves the ≥10% withdrawable buffer that IS the 9-day SLA (same constraint); (3) destination transient-detector — discount any dest whose headline APY is an above-90%-util spike. Estimator changed to `Δ$/yr ≈ x·(targetRate_dest − targetRate_source)`. Tools: `simulate_morpho_deposit_for_utilization`, `simulate_morpho_max_withdrawal` (util-cap-aware). **Open item:** confirm util is directly queryable for cross-chain markets (HyperEVM/Base) so their 90%-util rate can be read, not just the headline spot — Run 1's HyperEVM 10.82% was an unverified spot and may be an above-target spike.

### Run 1 (session 2026-07-16) — first live run, mainnet→HyperEVM sweep
- **State**: mainnet Morpho 5.22% ($3.576M), Base 4.89% ($1.352M), HyperEVM **10.82%** ($880k), AMO $1.016M (10% floor = $684k → **$331k excess**), buffer $17k. Total AUM $6.841M. Outstanding redemptions only $17k → **9-day SLA slack, non-binding**.
- **METHODOLOGY BUG FOUND & FIXED**: the naive `Δ$/yr = (balance)·(post-move spot APY)` is broken on the withdrawal side. Pulling 600k from mainnet spiked its spot 5.22%→14.46% and the naive calc claimed +$260k/yr — an artifact (util spike mean-reverts). Fixed methodology §3 to use `Δ$/yr ≈ x·(deposit.newApy − curApy_source)`, holding the source at equilibrium. Skill Phase 3 updated to match.
- **Mainnet→HyperEVM corrected sweep** (Δ$/yr): 150k→+$6.3k, 300k→+$10.5k, 450k→+$13.0k, 600k→+$14.0k. Diminishing returns, marginal gain ~dead past ~450k. Recommended **300–450k, staged**, ≈ +16–19 bps blended APY.
- **Mainnet withdrawal sensitivity is HIGH despite being "deep"**: 77bps/150k, 335bps/300k, 616bps/450k, 924bps/600k. Deep for *deposits* (~2bps/25k) but shallow for *withdrawals* — only $917k liquidity at 90% util. **Judge each direction separately.**
- **HyperEVM deposit sensitivity** (from current $880k @ 10.82%): −142bps/150k, −209bps/300k, −271bps/450k, −327bps/600k. Absorbs size reasonably; much deeper than earlier-session readings.
- **Base withdrawal**: 165bps/25k (still very thin, consistent with prior).
- **AMO flipped OUSD-heavy**: 38% USDC / 62% OUSD (was USDC-heavy last snapshot). Peg still tight.
- **Top candidate for next run (not yet swept): Base→HyperEVM.** Both cross-chain, so reallocating the worst cross-chain leg (Base 4.89%) into the best (HyperEVM 10.82%) improves yield with **zero fast-liquid/SLA cost** — structurally cheaper than mainnet→HyperEVM. Must check Base withdrawal liquidity (`isPartial`) — thin market may cap size.
- No moves executed (plan only).


### Seed (session 2026-07-16, pre-first-run) — observed while designing the skill
- Live OUSD allocation snapshot (mainnet vault `0xE75D…2F70`, ~$6.84M AUM):
  - Mainnet Morpho v2 `0x3643…fff6e`: $3,576,026 (52.3%)
  - CrossChain → Base Morpho `0xB1d6…0866`: $1,352,042 (19.8%)
  - Curve OUSD/USDC AMO `0x26a0…Ce11`: $1,015,517 (14.8%) — above the 10% floor
  - CrossChain → HyperEVM `0xE022…EA1e`: $880,539 (12.9%)
  - Vault buffer (undeployed USDC): $17,205 (0.25%)
- Withdrawal queue was fully funded (shortfall 0); ~$17k pending claims outstanding.
- AMO pool: ~$1.07M TVL, ~52.7% USDC / 47.3% OUSD, peg tight (sell 0.99997 / buy 1.00017).
- Directional finding reused all session: **mainnet → HyperEVM was the attractive move** (deep source, thin high-yield dest); **Base → anything** was a poor source (too thin). No allocation was committed — analysis only.
