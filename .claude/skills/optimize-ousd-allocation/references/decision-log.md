# Decision log & post-hoc scoring

Every time the skill produces a rebalancing plan, it appends one entry to `decisions/decision-log.jsonl`. Later, a **review pass** joins each entry with Grafana history (`morpho_vault_apy`) to score how good the decision actually was — did the projected rate hold, or did we chase a spike that reverted? The scores feed `LEARNINGS.md` to calibrate the sustainable-rate model and sizing.

This closes the loop: **recommend → log → (execute) → review against realized data → learn.**

## Log format — `decisions/decision-log.jsonl` (append-only, one JSON object per line)

```jsonc
{
  "ts": "2026-07-16T13:00:00Z",        // wall clock, UTC (bash: date -u +%FT%TZ)
  "block": 25544361,                    // mainnet block at decision time
  "state": {                            // OUR INDEPENDENT reads (on-chain + MCP), not the production feed
    "ethereum": { "balance": 3576087, "apy": 0.0521, "util": 0.9000 },
    "base":     { "balance": 1352042, "apy": 0.0489, "util": 0.8662 },
    "hyperevm": { "balance": 880539,  "apy": 0.1083, "util": 0.9173 },
    "amo":      { "balance": 1015517 },
    "vault_buffer": 17205
  },
  "recommendation": {
    "moves": [ { "from": "base", "to": "hyperevm", "amount": 150000,
                 "destRateSpot": 0.1083, "destRateSustainable": 0.094 } ],
    "expectedDeltaPerYr": 6780,         // sustainable $/yr, source held at equilibrium
    "blendedApyBefore": null, "blendedApyAfter": null,
    "sustainableBasis": "hyperevm valued at ~90%-util rate, not 10.8% spot (util 91.7% = above target)",
    "constraintsBound": ["hyperevm thin per MCP; staged", "AMO held at 10% floor"]
  },
  "productionRebalancer": {             // for cross-check only — NOT an input
    "delta": { "hyperevm": 150000, "vault": -150000 },
    "agreesOnDestination": true, "agreesOnSource": false
  },
  "executed": "unknown",                // unknown | yes | no | partial | observed-onchain
  "execBlock": null, "execTs": null,
  "review": null                        // filled in later by the review pass (see below)
}
```

Keep entries to genuine rebalancing decisions (infrequent), so the log stays auditable. The real token/secret never appears here — only public state.

## Review pass — scoring a past decision

For each entry with a move `from → to` decided at time `T`, pull the realized history from Grafana and compare against what we projected:

1. **Realized destination APY**: `query_range morpho_vault_apy{chain=<to>}` over `[T, T+7d]` (or until now). Take the mean/median.
2. **Did it hold?** Compare realized vs the logged `destRateSustainable` (our estimate) AND vs `destRateSpot` (the headline we deliberately did *not* bank on).
   - realized ≈ sustainable → our sustainable-rate call was right; the 90%-util anchor worked.
   - realized ≪ spot and ≈ sustainable → we correctly avoided chasing a spike. Good.
   - realized ≪ sustainable → we over-estimated; the destination reverted further than expected. Calibrate down.
3. **Was the move net-positive?** realized `to`-APY vs realized `from`-APY over the same window → did the moved dollars actually out-earn where they came from?
4. **Sizing**: did the destination's util/APY stay healthy at the size we moved, or did we overshoot (rate collapsed)? Cross-check `ousd_rebalancer_strategy_*` history if useful.

Write the result back into the entry's `review` field:
```jsonc
"review": { "reviewedTs": "2026-07-23T00:00:00Z", "windowDays": 7,
  "realizedDestApy": 0.091, "realizedSourceApy": 0.049,
  "verdict": "good", "realizedDeltaPerYr": 6300,
  "note": "hyperevm held ~9.1% vs 9.4% projected; did not revert to 6.6%. Sizing fine." }
```
Verdicts: `good` (held, net-positive), `marginal`, `bad` (reverted / net-negative), `unexecuted` (decision not acted on — record the counterfactual anyway).

## Feeding LEARNINGS
After a review round, append the calibration deltas to `LEARNINGS.md`: where our sustainable-rate estimate was off (and by how much), which markets revert hardest, whether our sizing was too big/small. That is what makes the *next* decision better.

## Tooling
- Log balances/APYs from the skill's own Phase-0/1 reads (independent), not the production feed.
- The review pass can be an LLM step or extend `scripts/backcheck.py`. History query recipe: `references/grafana-history.md` (`query_range` on `grafanacloud-prom`). `date -u +%FT%TZ` for timestamps (scripts must not rely on wall-clock inside workflow engines, but a plain shell/CLI run is fine).
