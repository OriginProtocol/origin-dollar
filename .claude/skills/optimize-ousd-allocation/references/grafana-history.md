# Historical data via Grafana HTTP API (no MCP needed)

The OUSD APY/allocation history already lives in the team's **Grafana Cloud** (Prometheus). For our narrow need (a few known metrics), the **easiest access is the Grafana datasource-proxy HTTP API with a read-only service-account token** — no MCP server, no container, no bespoke snapshotter. Verified live 2026-07-16 via the same proxy the dashboards use.

Access ranking, easiest → hardest: **Grafana HTTP API + Viewer token** ≪ `mcp-grafana` container ≪ Grafana built-in MCP (needs Grafana support to enable the `mcpServer` toggle on the Cloud stack; `/api/mcp` currently 404s) ≪ bespoke on-chain snapshotter.

> The skill's **core job (recommend now) needs no history at all** — current state comes from on-chain + MCP. History is only for back-checking past moves and calibrating sensitivity priors.

## Deployment facts (verified)
- Grafana is **Cloud Pro** at `https://grafana.originprotocol.com` (Cloudflare-fronted, edition "Cloud Pro").
- Prometheus datasource UID holding these metrics: **`grafanacloud-prom`**.
- Auth: a **Viewer service-account token** (see below). Store as `GRAFANA_TOKEN` in `contracts/.env` (gitignored); never in a tracked file.

## Getting a GRAFANA_TOKEN (one-time)
Requires org-admin on the Grafana instance.
1. Grafana → **Administration → Users and access → Service accounts** (`/org/serviceaccounts`).
2. **Add service account** → name e.g. `ousd-rebalance-readonly` → role **Viewer** (least privilege) → **Create**.
3. On the account page → **Add service account token** → (optional expiry) → **Generate token**.
4. **Copy it immediately** — shown only once. That value is `GRAFANA_TOKEN`.
5. Put it in `contracts/.env` (gitignored): `GRAFANA_TOKEN=glsa_...`. The tracked `contracts/dev.env` only carries a blank `GRAFANA_TOKEN=` placeholder — never the real value.
6. If a `query`/`query_range` call returns **403**, the account also needs the **"Data sources → Query"** permission (add via a custom role); Viewer alone usually suffices.
7. Verify:
   ```bash
   curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" \
     "https://grafana.originprotocol.com/api/datasources/proxy/uid/grafanacloud-prom/api/v1/query?query=morpho_vault_apy" | head -c 200
   ```
   `"status":"success"` = working.

> Alternatives to a stack service-account token: the built-in Grafana MCP (`/api/mcp`) — currently **404**, needs Grafana support to enable `mcpServer` on the Cloud stack — or a self-hosted `mcp-grafana` container using the same token. Neither is required; the HTTP API above is the simplest.

## The metrics we care about
| Metric | Labels | Meaning |
|---|---|---|
| `morpho_vault_apy` | `chain` = ethereum \| base \| hyperevm (18 series — extra label(s) exist, e.g. spot vs windowed; enumerate when wiring) | per-chain Morpho vault APY, historical |
| `ousd_rebalancer_strategy_current_balance` | `name` (Ethereum Morpho / Base Morpho / HyperEVM Morpho / OUSD Vault), `address` | production rebalancer's current balance per strategy |
| `ousd_rebalancer_strategy_target_balance` | same | production rebalancer's TARGET |
| `ousd_rebalancer_strategy_delta` | same | target − current (the production recommendation) |

Related dashboards (Prometheus-backed): **Rebalancer** (`shw2lct`, has Vault-APYs tab), **Strategy Collateral** (`4bb73fb5…`), **Morpho Data – Origin Markets** (`chqsgkv`, has utilization). Detailed earnings history is in **OUSD Strategy Earnings** (`f40d88db…`) but that's **Postgres** — reachable via the same proxy with a SQL/`/api/ds/query` call, not PromQL.

## Recipes
Instant value:
```bash
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" \
 "https://grafana.originprotocol.com/api/datasources/proxy/uid/grafanacloud-prom/api/v1/query?query=ousd_rebalancer_strategy_delta"
```
Range (history — for back-check / calibration):
```bash
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" \
 "https://grafana.originprotocol.com/api/datasources/proxy/uid/grafanacloud-prom/api/v1/query_range?query=morpho_vault_apy&start=<unix>&end=<unix>&step=3600"
```
Response is standard Prometheus JSON: `data.result[].metric` (labels) + `.value`/`.values`.

## How the skill uses this — verify, don't rely
The production rebalancer's `ousd_rebalancer_*` series are a **cross-check target, NOT an input**. The skill computes its own current/target/delta independently (on-chain `checkBalance` + Morpho Blue util + MCP/IRM APY + its optimizer), then compares:
- **Balances**: our on-chain `checkBalance` vs `ousd_rebalancer_strategy_current_balance` — divergence ⇒ the production feed is stale/wrong (e.g. observed: Grafana vault buffer 150k vs on-chain ~17k).
- **Recommendation**: our derived delta vs `ousd_rebalancer_strategy_delta` — agreement is corroboration; divergence is a flag to investigate on one side or the other.
- **APY history**: `morpho_vault_apy` back-checks executed moves (did the post-move APY hold or revert?) and calibrates sensitivity priors in `LEARNINGS.md`.

On-chain `cast` remains the spot-truth verifier for anything Grafana asserts.
