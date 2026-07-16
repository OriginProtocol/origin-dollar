---
description: "Analyze and recommend optimal OUSD capital rebalancing across all enabled strategies — the three Morpho strategies (Ethereum, Base, HyperEVM), the Curve OUSD/USDC AMO, and the OUSD Vault buffer — to maximize total annual USDC earnings, subject to production constraints and redemption liquidity. Trusts on-chain reads over the MCP and learns across runs. Use whenever the user asks about: rebalancing/optimizing OUSD, optimal allocation, whether to move funds between chains/strategies, 'should I move X from Y to Z', 'what's the best allocation', maximizing OUSD yield, vault shortfall/surplus, or says 'optimize ousd' / 'rebalance ousd' / '/optimize-ousd-allocation'. Runs autonomously; outputs a PLAN, never executes moves."
user_invocable: true
---

# OUSD Allocation Optimizer

Autonomously find the OUSD collateral allocation that **maximizes total annual USDC earnings** across every bucket, then output an executable rebalancing plan. No user input required.

**You produce a plan; you never execute moves.** Relocating funds is a Strategist-multisig action. Deliverable = the net moves + expected $/yr gain, for a human to sign.

**Base lineage:** this skill merges a production-grounded rebalancer (the `ousdConstraints` gates, greedy step algorithm, freeze guards, spread-floor knowledge) with (a) an **independent on-chain verification layer** — we do not fully trust the MCP — (b) **AMO coverage**, (c) the **sustainable-vs-transient rate** correction, and (d) a **persistent learning loop**.

> ## TODO — known gaps
> - **AMO realized APY not wired.** No data source for the Curve OUSD/USDC AMO's fee+gauge yield. Hold AMO at its 10% floor; flag opportunity cost only. AMO-vs-Morpho yield tradeoffs are out of scope until closed.

## The buckets

- **Ethereum Morpho** (chain 1) — MetaMorpho vault over Blue markets (OETH/USDC + others), OETH/USDC hard-capped at **90% util**.
- **Base Morpho** (chain 8453) — cross-chain (CCTP), bridge-slow.
- **HyperEVM Morpho** (chain 999) — cross-chain (CCTP), bridge-slow.
- **Curve OUSD/USDC AMO** — redemption/peg liquidity; **≥10% of TVL floor**. *(Omitted by the base rebalancer — do not omit it; it's ~15% of collateral.)*
- **OUSD Vault buffer** — idle USDC (0% APY) and the withdrawal queue.

## Core principle — optimize dollars, and sustainable dollars

Objective: maximize `TotalYield = Σ(balanceᵢ × APYᵢ)` (annual USDC). Relocation keeps total AUM fixed, so this equals maximizing blended OUSD APY. **Marginal APY only *orders* candidate moves; the accept/reject gate is always the global `TotalYield` delta** — never a single strategy's rate.

Value each market at its **sustainable rate (rate at 90% target utilization)**, not a transient spot spike. Withdrawing spikes a market's rate above target; that reverts within hours as borrowers repay. See `references/methodology.md` §3, §9. Do **not** credit a withdrawn source's remaining balance at its spiked rate — that's the classic bug that tells you to drain a market.

## Production constraints (`ousdConstraints`)

| Constraint | Value | Use |
|---|---|---|
| `minMoveAmount` | $5K | drop any net move below this |
| `crossChainMinAmount` | $25K | drop Base/HyperEVM net moves below this |
| `minApySpread` | 0.5% | a withdrawal fires only if source APY ≥ 0.5% below best destination |
| `maxApyThreshold` | 50% | strategy **frozen** (no deposit/withdraw) if APY above this — suspected manipulation |
| elevated-APY caution | ~15% | not frozen, but flag as volatile/likely-to-revert |
| `allocationChunkSize` | $50K | greedy step granularity |
| OETH util cap | 90% | Ethereum withdrawal limit |
| OETH/wstETH spread floor | 0.5% | can block Ethereum withdrawals even when util is fine |

> ⚠️ **Spot vs windowed APY:** production allocates on a 1h time-windowed average APY and blocks deposits when spot diverges >200 bps below it (`maxSpotBelowAvgBps`). The MCP exposes only **spot**. So treat single readings as noisy — re-fetch to confirm a rate is stable before acting, especially HyperEVM.

---

## Before you start
Read `references/methodology.md` (optimization math, 90%-util anchor), `references/onchain-verification.md` (verified `cast` cookbook + all addresses/RPCs), and `LEARNINGS.md` (accumulated market-sensitivity heuristics — seed your sweep sizes from it).

## Phase 0 — Refresh state (MCP) AND verify on-chain

Never use cached data. Fetch MCP and on-chain in parallel, then **reconcile**.

**MCP (parallel):** `get_morpho_market_stats(oeth-usdc)`, `simulate_morpho_max_withdrawal(chain_id=1/8453/999)`, `get_vault_withdrawal_shortfall`, `get_amo_pool_state` + `get_amo_pool_price`.

**On-chain (`cast`, run from `contracts/`; commands + addresses in `references/onchain-verification.md`):**
1. **Enabled strategies** — `getAllStrategies()` on the vault. Classify: name `AMO`→AMO; `Morpho`+not-cross-chain→mainnet Morpho; `CrossChain*Master`→cross-chain (Base 8453 / HyperEVM 999).
2. **True deployed balance per bucket** — `strategy.checkBalance(USDC)` and cross-check `V2Vault.totalAssets()` per chain. **This is the balance you use — NOT the MCP's `maxPossibleAmount`** (that's a withdrawal ceiling, not deployed; it undercounts Ethereum by ~60%).
3. **Vault buffer** — `USDC.balanceOf(vault)`.

**Reconcile:** for each figure, compare MCP vs on-chain. If they diverge materially (say >1%), trust on-chain and note the discrepancy. Check MCP freshness: `cast block-number` vs the MCP's reported block — if the MCP is far behind, distrust its APYs too.

Print a state table: bucket, address, deployed balance, spot APY, on-chain util, % of AUM, liquidity tier (fast: vault/AMO/mainnet Morpho; slow: cross-chain).

## Phase 1 — On-chain verification of market health (the trust-but-verify layer)

For each Morpho bucket, read the underlying Blue markets directly (`references/onchain-verification.md`) — the MCP abstracts these and cannot show cross-chain util:

- **Real utilization** — enumerate `V1Vault.withdrawQueue(i)` for `i in 0..withdrawQueueLength-1`; for each `marketId`, `Morpho.market(marketId)` → `util = borrowAssets / supplyAssets`. A market **above 90% util means its APY is an above-target spike that will revert** — discount that bucket's headline APY to its ~90%-util sustainable level. (Verified live: HyperEVM markets ~91.7% util → its high APY is transient.)
- **Available liquidity** — `supplyAssets − borrowAssets` per market → the instantaneous withdrawal ceiling. A proposed withdrawal must fit within Σ available across the markets we're supplied in, or it's partial. **Do NOT use `maxWithdraw`/`maxDeposit` on the Vault-V2 — they return 0 (non-standard).**
- **Our per-market position** — `Morpho.position(marketId, v1Vault)` → where our funds actually sit and how much is pullable from each.

## Phase 2 — Constraints → movable budget

- **AMO floor**: keep AMO ≥ 10% of TVL (redemption/peg liquidity). Excess above floor is a candidate source, but treat as low-confidence (AMO yield unknown — TODO). If AMO is pinned at floor and Morpho marginal >> plausible AMO yield, state the annualized opportunity cost verbosely.
- **90% target utilization = the redemption liquidity floor = the 9-day SLA.** At 90% util, 10% of each market is liquid. **Never size a withdrawal past the point it drives a market above 90% util** — that eats the redemption buffer AND chases a transient rate. Keeping markets ≤90% util is what guarantees the fast-liquid tier the SLA needs.
- **Vault buffer / 9-day SLA**: keep `shortfall == 0` and fast-liquid tier ≥ outstanding `(queued − claimed)` + margin. Cross-chain funds are bridge-slow; they do **not** count toward the SLA.
- **Freeze**: any strategy with APY > 50% is frozen (no deposit/withdraw, excluded as candidate). Caution-flag 15–50%.
- **Caps**: respect Morpho supply caps (`isCapped`/`isPartial`; verify cap headroom on-chain for large deposits).

Movable budget = Σ withdrawable(bucket) + vault surplus − reserved (AMO floor, OETH-headroom, frozen).

## Phase 3 — Vault status first (priority over yield)

- **Shortfall > 0**: always fund it, any size. Default source **Ethereum Morpho** (same-chain, cheap); exception — if Ethereum is worst-APY or funding would push OETH util >90%, source from the lowest-APY strategy that can absorb it. Confirm with `simulate_morpho_action(withdraw,...)`. Subtract funded amount before rebalancing.
- **Shortfall = 0, idle USDC**: deploy it (part of the movable budget) unless deploying lowers total earnings.
- If OETH util is currently >90%: compute the deposit that brings it back under 90% (`simulate_morpho_deposit_for_utilization(oeth-usdc, 0.90)`) and reserve it for Ethereum regardless of yield (market health).

## Phase 4 — Greedy step allocation

Distribute the movable budget one `$50K` step at a time (smaller steps + re-fetch anchor for volatile HyperEVM). Full algorithm in `references/methodology.md`; the gate:

1. Value every bucket at its current working balance (deployed-anchored sim: simulate the delta from actual deployed, read `newApy`), using the **sustainable (90%-util) rate**, not the transient spot — compute `E_before = Σ(bal × sustainableApy)`.
2. Order candidates by marginal APY at `+step` (ordering only).
3. **Accept iff `E_after > E_before`** (whole stack re-priced at the new rate). If no bucket raises total earnings, stop — leave the remainder idle at 0% rather than deploy at a loss.
4. Commit: `bal(chosen) += step`, `budget −= step`.

Non-monotonicity is expected: a thin/volatile bucket's `balance × APY` curve often **peaks near its current deployed level** (adding compresses the whole stack). The optimum for HyperEVM is frequently "leave it ≈ where it is." Estimator for a cross-chain move: `Δ$/yr ≈ x·(sustainableRate_dest − sustainableRate_source)`; size destinations by how much brings them to 90% util, not by the headline APY.

## Phase 5 — Executability gates, then on-chain pre-flight

Derive net moves: `net_move(s) = targetBalance(s) − deployed(s)`. Filter through the production gates:
- `minApySpread` 0.5% — cancel a withdrawal if source APY isn't ≥0.5% below the best destination.
- `minMoveAmount` $5K — drop smaller net moves.
- `crossChainMinAmount` $25K — drop Base/HyperEVM net moves below this.

**Then pre-flight each surviving move on-chain** (don't trust the MCP's sizing blindly):
- Withdrawal ≤ Σ on-chain available liquidity in the source's markets (else it's partial).
- Post-move util recomputed on-chain stays ≤90% on the source; deposit doesn't breach a cap.
- Ethereum: confirm the *real* withdrawable with `simulate_morpho_action(withdraw,...)` — `max_withdrawal` often returns $0 due to the wstETH/OETH spread floor even when util math says it's safe.

## Phase 6 — Report

Before/after tables (bucket, deployed, APY, $/yr; total + blended APY), the net moves with the executing call per leg, `TotalYield` baseline→proposed with the **Δ/yr** headline (star the optimum). Surface: frozen/elevated strategies, AMO opportunity cost, any constraint that bound the solution, any MCP↔on-chain discrepancies found, and low-confidence (within-drift) edges. If nothing clears the gates: **"No rebalancing recommended — current allocation is already optimal."** End with the non-execution note (Strategist multisig).

## Phase 7 — Log the decision

Every time you produce a rebalancing plan, **append one entry to `decisions/decision-log.jsonl`** (schema + rationale in `references/decision-log.md`): the independent state you read (balances/APY/util per bucket), the recommended moves with the **sustainable** dest rate you valued them at (not the spot), `expectedDeltaPerYr`, constraints that bound it, and the production rebalancer's delta for cross-check. Set `executed` to `unknown` (update later if you learn it executed). Use only your own independent reads here, never the production feed. This log is what makes decisions reviewable.

## Phase 8 — Review past decisions (scoring, closes the loop)

Periodically (or when asked), score prior `decision-log.jsonl` entries against **realized Grafana history**: for each logged move `from → to` at time `T`, `query_range morpho_vault_apy{chain=<to>}` over `[T, T+7d]` and compare realized APY to the `destRateSustainable` you projected (and to the `destRateSpot` you deliberately didn't bank on). Verdict `good`/`marginal`/`bad`, write it into the entry's `review` field, and feed the calibration delta (where our sustainable estimate was off, which markets revert hardest, sizing too big/small) into `LEARNINGS.md`. Full method in `references/decision-log.md`; history recipe in `references/grafana-history.md`.

## Phase 9 — Feed back into LEARNINGS.md

Append a dated entry: per-market **sensitivity** (bps per $100k, at what balance), on-chain util readings, any caps/liquidity/bridge limits hit, the allocation found + blended APY, MCP↔on-chain discrepancies, decision-review calibration deltas, and surprises. This is the skill's memory — seed the next run from it.

## Verify the production rebalancer (don't rely on it)

A production rebalancer already emits `ousd_rebalancer_strategy_{current,target,delta}_balance` and `morpho_vault_apy{chain}` to Grafana Cloud Prometheus. **Treat these as a cross-check target, NOT an input.** The skill computes its own current/target/delta independently (on-chain `checkBalance` + Morpho Blue util + MCP/IRM APY + its optimizer), then compares — so it independently confirms the production rebalancer is working:
- our `checkBalance` vs `ousd_rebalancer_strategy_current_balance` — divergence ⇒ production feed stale/wrong.
- our derived delta vs `ousd_rebalancer_strategy_delta` — agreement corroborates; divergence is a flag.

**Helper:** `scripts/backcheck.py` (run from `contracts/`; reads `GRAFANA_TOKEN` + `PROVIDER_URL` from `.env`) pulls the `ousd_rebalancer_*` + `morpho_vault_apy` metrics, diffs them against on-chain `checkBalance`, flags any >1% divergence, and surfaces the AMO (which the rebalancer omits). No secrets in the file — the token stays in `.env`.

**Observed 2026-07-16** (baseline for what "working" vs "diverging" looks like): Ethereum & Base matched Grafana to the dollar ✓; **HyperEVM's Grafana `current` was stale** (880k vs on-chain 1,030k — already at the published target); **OUSD Vault diverged 89%** (Grafana 150k vs on-chain 17k); **AMO ($1.02M) is untracked** by the rebalancer entirely. Also seen: a 150k Base→HyperEVM shift had already executed on-chain while Grafana still showed the pre-move `current`. Takeaway: the production `current`/`delta` feed **lags and can be inconsistent** — always reconcile to on-chain before acting.

## Monitoring & back-check (history)

The skill's **core recommendation needs no history** — current state is on-chain + MCP. History matters only to (a) back-check executed moves (did post-move APY hold or revert?) and (b) calibrate sensitivity priors in `LEARNINGS.md`.

**Easiest history source: the Grafana HTTP API + a read-only token — no MCP server, no container, no bespoke snapshotter.** The data already lives in Grafana Cloud Prometheus (`grafanacloud-prom`); one authenticated `query_range` call gets it. Full recipes, metric names, and the verify-vs-production logic are in `references/grafana-history.md`. Access ranking easiest→hardest: Grafana HTTP API + Viewer token ≪ `mcp-grafana` container ≪ built-in MCP (needs Grafana to enable on Cloud) ≪ on-chain snapshotter. Keep `cast` as the spot cross-check regardless.

**Review pass** (infrequent, LLM): pull the series, flag anomalies (APY > freeze 50% / caution 15%, util > 90%, our-vs-production divergence, a rate reverting after a move), back-check moves logged in `LEARNINGS.md`, append findings. Optionally scheduled locally later; no schedule created yet.

## Guardrails (quick reference)
- Never cached data — refetch live; verify on-chain; trust on-chain over MCP on conflict.
- Objective = total earnings on all TVL; marginal APY only orders; global Δ is the gate.
- Value markets at the 90%-util sustainable rate; never credit a source at its withdrawal spike.
- OETH util hard cap 90%; never breach; spread floor can block Ethereum withdrawals — confirm with `simulate_morpho_action`.
- AMO ≥10% floor; freeze APY>50%; caution 15–50%.
- Gates: 0.5% spread, $5K / $25K move floors, $50K step.
- Vault shortfall always funded; idle USDC deployed unless it lowers earnings.
- Net moves, not drain-and-refill. Plan only — never execute.
- Amounts in 1e6 USDC units ($1 = `1000000`, $100K = `100000000000`).
