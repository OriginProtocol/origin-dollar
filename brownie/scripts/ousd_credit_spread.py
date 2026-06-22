#!/usr/bin/env python3
"""
OUSD APY vs USDC borrow rates — spread analysis for the OUSD Credit-Market AMO idea.

Produces:
  brownie/reports/ousd-credit-spread/overlay.png  - OUSD APY vs borrow rates over time
  brownie/reports/ousd-credit-spread/spread.png   - (borrow - OUSD APY) over the floor band
  brownie/reports/ousd-credit-spread/data.csv     - aligned daily series

Markets (all loan asset = USDC, Ethereum mainnet, Morpho Blue):
  PILOT (bold)  - the doc's OUSD-relevant benchmark markets:
       OETH/USDC, wstETH/USDC
  BROAD (thin)  - the wider blue-chip USDC borrow market, from the 2026-06-19 Morpho
       borrow screenshot: cbBTC, WBTC, WETH, weETH and the public-allocator
       wstETH/WBTC/cbBTC markets. Size suffixes disambiguate the duplicate collateral
       pairs; the small "share a ~42M public-allocator pool" markets carry a size tag.

Data (all APY, daily):
  - OUSD APY:           DefiLlama yields chart (origin-dollar OUSD pool)  ~7d trailing
  - Morpho borrow:      Morpho Blue API historicalState.borrowApy
  - Aave V3 / Compound V3 USDC borrow: DefiLlama /lendBorrow (CURRENT level only;
    DefiLlama's historical-borrow endpoint is paywalled -> shown as reference markers)

No web3 needed. Run with a python that has matplotlib+numpy.
"""
import json, os, time, urllib.request, urllib.error, datetime as dt
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

UA = {"User-Agent": "Mozilla/5.0 ousd-research"}
OUT = os.path.join(os.path.dirname(__file__), "..", "reports", "ousd-credit-spread")
OUT = os.path.abspath(OUT)
os.makedirs(OUT, exist_ok=True)

BUFFER = 0.5          # rate-floor buffer in percentage points
WINDOW_DAYS = 365     # chart window
SMOOTH = 30           # trailing smoothing window (days)

OUSD_POOL = "529258ee-9b27-4fcf-a32c-b82abb3fda68"

# PILOT = the doc's OUSD-relevant benchmark markets (drawn bold).
PILOT_MKTS = {
    "OETH/USDC":   "0xb8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e",
    "wstETH/USDC": "0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc",
}
# BROAD = wider blue-chip USDC borrow market (2026-06-19 Morpho screenshot), drawn thin.
# Size tags disambiguate duplicate collateral pairs; the ~42M-liquidity small markets
# (·46M / ·44M / ·43M) share a public-allocator pool and have only ~2 months of history.
BROAD_MKTS = {
    "cbBTC/USDC ·264M": "0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64",
    "WBTC/USDC ·138M":  "0x3a85e619751152991742810df6ec69ce473daef99e28a64ab2340d7b7ccfee49",
    "WETH/USDC":        "0x94b823e6bd8ea533b4e33fbc307faea0b307301bc48763acc4d4aa4def7636cd",
    "weETH/USDC ·77%":  "0x34377fc4f617c51818e92c79df31ff270c6a91bc94ad32e367fdf59b9f4ac5dd",
    "wstETH/USDC ·46M": "0x7e585a933ffe8443c371b4f8cfeb4430f5f6a14c2f32a898c26662c67a1cb8b8",
    "WBTC/USDC ·44M":   "0x09dc9e7eb5d8fc54b2bc41d1135fd4e99057a580f680321faeb90c7a21e631c1",
    "cbBTC/USDC ·43M":  "0xbc99de6a88904cd0e69042ad6f266e63182801f030c636507c3caf590ffd84fe",
    "PT-stcUSD/USDC":   "0x2fb3713487c7812e7309935b034f40228841666f6b048faf31fd2110ae674f20",
}
MORPHO_MKTS = {**PILOT_MKTS, **BROAD_MKTS}

AAVE_POOL = "aa70268e-4b52-42bf-a116-608b370f9501"
COMP_POOL = "7da72d09-56ca-4ec5-a45f-59114353e487"

# colors: pilot get strong fixed colors; broad get a qualitative palette.
PILOT_COLORS = {"OETH/USDC": "#1f77b4", "wstETH/USDC": "#ff7f0e"}
BROAD_PALETTE = ["#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#17becf", "#bcbd22", "#393b79"]
COLORS = dict(PILOT_COLORS)
for i, name in enumerate(BROAD_MKTS):
    COLORS[name] = BROAD_PALETTE[i % len(BROAD_PALETTE)]


def get(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90))


def gql(query):
    req = urllib.request.Request("https://blue-api.morpho.org/graphql",
                                 data=json.dumps({"query": query}).encode(),
                                 headers={**UA, "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=90))
    except urllib.error.HTTPError as e:
        return {"errors": [{"http": e.code, "body": e.read().decode()[:500]}]}


def d(ts):
    """epoch seconds OR iso string -> date"""
    if isinstance(ts, (int, float)):
        return dt.datetime.utcfromtimestamp(ts).date()
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00")).date()


# ---- fetch OUSD APY (DefiLlama, %) ----
ousd = {}
for r in get(f"https://yields.llama.fi/chart/{OUSD_POOL}")["data"]:
    if r.get("apy") is not None:
        ousd[d(r["timestamp"])] = float(r["apy"])
print(f"OUSD APY points={len(ousd)} latest={sorted(ousd)[-1]} {ousd[sorted(ousd)[-1]]:.2f}%")

# ---- fetch OUSD peg (CoinGecko daily USD price; proxy for the OUSD/USDC Curve pool) ----
# A soft peg raises the OUSD->USDC liquidation/repay cost, which lifts the real cost of an
# OUSD loan and shrinks borrower appeal - so the peg is a risk overlay on the rate spread.
peg = {}
try:
    cg = get("https://api.coingecko.com/api/v3/coins/origin-dollar/market_chart"
             "?vs_currency=usd&days=365&interval=daily")
    for ts, px in cg.get("prices", []):
        peg[dt.datetime.utcfromtimestamp(ts / 1000).date()] = float(px)
    pk = sorted(peg)
    print(f"OUSD peg points={len(peg)} latest={peg[pk[-1]]:.4f} min={min(peg.values()):.4f}")
except Exception as e:  # noqa: BLE001 - peg is a non-critical overlay
    print(f"OUSD peg: FAILED -> {e}")

# ---- fetch Morpho borrow APY series (%) ----
E = int(time.time()); S = E - (WINDOW_DAYS + SMOOTH + 5) * 86400
morpho = {}
for name, mid in MORPHO_MKTS.items():
    q = ('{ marketById(marketId:"%s", chainId:1){ historicalState{ '
         'borrowApy(options:{startTimestamp:%d, endTimestamp:%d, interval:DAY}){ x y } } } }' % (mid, S, E))
    res = gql(q)
    series = (((res.get("data") or {}).get("marketById") or {}).get("historicalState") or {}).get("borrowApy")
    if not series:
        print(f"  {name}: FAILED -> {json.dumps(res)[:300]}")
        morpho[name] = {}
        continue
    morpho[name] = {d(p["x"]): float(p["y"]) * 100 for p in series if p.get("y") is not None}
    k = sorted(morpho[name])
    print(f"  {name}: points={len(morpho[name])} latest={morpho[name][k[-1]]:.2f}%")

# ---- current reference levels (DefiLlama /lendBorrow, %) ----
lb = {r["pool"]: r for r in get("https://yields.llama.fi/lendBorrow")}
refs = {
    "Aave V3 USDC (current)":     lb.get(AAVE_POOL, {}).get("apyBaseBorrow"),
    "Compound V3 USDC (current)": lb.get(COMP_POOL, {}).get("apyBaseBorrow"),
}
print("refs:", {k: (round(v, 2) if v else None) for k, v in refs.items()})

# ---- align on daily index ----
today = dt.date.today()
idx = [today - dt.timedelta(days=i) for i in range(WINDOW_DAYS - 1, -1, -1)]


def align(series):
    """map date->val onto idx with forward-fill; NaN before the first data point"""
    out = np.full(len(idx), np.nan)
    if not series:
        return out
    keys = sorted(series)
    last = np.nan
    j = 0
    for i, day in enumerate(idx):
        while j < len(keys) and keys[j] <= day:
            last = series[keys[j]]; j += 1
        out[i] = last
    return out


def roll(a, w=SMOOTH):
    out = np.full(len(a), np.nan)
    for i in range(len(a)):
        seg = a[max(0, i - w + 1):i + 1]
        seg = seg[~np.isnan(seg)]
        if len(seg):
            out[i] = seg.mean()
    return out


def last_val(arr):
    v = arr[~np.isnan(arr)]
    return v[-1] if len(v) else float("nan")


ousd_a = align(ousd); ousd_s = roll(ousd_a)
peg_a = align(peg)
mkt_a = {name: align(s) for name, s in morpho.items()}
mkt_s = {name: roll(a) for name, a in mkt_a.items()}

xt = [dt.datetime.combine(x, dt.time()) for x in idx]


def style(ax):
    ax.xaxis.set_major_locator(mdates.MonthLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
    ax.grid(True, alpha=0.25)
    ax.set_ylabel("APY (%)")


# ===== Figure 1: overlay (rates) + OUSD peg strip =====
fig, (ax, axp) = plt.subplots(2, 1, figsize=(12.5, 7.8), sharex=True,
                              gridspec_kw={"height_ratios": [4, 1], "hspace": 0.08})
# --- top panel: rates ---
ax.plot(xt, ousd_a, color="black", alpha=0.12, lw=1)
ax.plot(xt, ousd_s, color="black", lw=2.8,
        label=f"OUSD APY  30d {last_val(ousd_s):.2f}%  (spot {last_val(ousd_a):.2f}%)")
for name in PILOT_MKTS:
    c = COLORS[name]
    ax.plot(xt, mkt_a[name], color=c, alpha=0.12, lw=1)
    ax.plot(xt, mkt_s[name], color=c, lw=2.5,
            label=f"{name} borrow  30d {last_val(mkt_s[name]):.2f}%  (spot {last_val(mkt_a[name]):.2f}%)  [pilot]")
for name in BROAD_MKTS:
    if not morpho[name]:
        continue
    ax.plot(xt, mkt_s[name], color=COLORS[name], lw=1.3, alpha=0.85,
            label=f"{name}  {last_val(mkt_s[name]):.2f}%")
for (label, val), ls in zip(refs.items(), ["--", ":"]):
    if val:
        ax.axhline(val, color="gray", ls=ls, lw=1.3, alpha=0.8, label=f"{label}  ({val:.2f}%)")
ax.set_title("OUSD APY vs USDC borrow rates + OUSD peg — Ethereum (12 mo; bold = OUSD + pilot markets, "
             "thin = broader USDC market; 30-day smoothed)")
style(ax)
ax.tick_params(labelbottom=False)
ax.set_ylim(2, 8.5)
ax.text(xt[1], 8.2, "daily borrow spikes (utilization-driven) clipped above 8.5%",
        fontsize=7, color="gray", style="italic", va="top")
ax.legend(loc="upper left", fontsize=7, framealpha=0.92, ncol=2)
# --- bottom panel: OUSD/USDC peg (a soft peg raises OUSD->USDC liquidation cost) ---
axp.axhspan(0.995, 0.998, color="#e6b800", alpha=0.12)
axp.axhspan(0.985, 0.995, color="#d62728", alpha=0.10)
axp.axhline(1.0, color="gray", ls="--", lw=1)
axp.plot(xt, peg_a, color="#0d7d7d", lw=1.6)
axp.set_ylim(0.990, 1.008)
axp.grid(True, alpha=0.25)
axp.set_ylabel("OUSD peg\n($/USDC)", fontsize=8)
axp.xaxis.set_major_locator(mdates.MonthLocator())
axp.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
peg_lbl = f"{last_val(peg_a):.4f}" if not np.isnan(last_val(peg_a)) else "n/a"
axp.text(0.004, 0.08,
         f"discount (amber/red) -> costlier OUSD->USDC liquidation = higher real borrow cost.  latest {peg_lbl}",
         transform=axp.transAxes, fontsize=7, color="#555", va="bottom")
fig.savefig(os.path.join(OUT, "overlay.png"), dpi=150, bbox_inches="tight"); plt.close(fig)

# ===== Figure 2: spread + floor band =====
fig, ax = plt.subplots(figsize=(12.5, 6.6))
ymin, ymax = -2.5, 3.0
ax.axhspan(BUFFER, ymax, color="#2ca02c", alpha=0.10)
ax.axhspan(0, BUFFER, color="#e6b800", alpha=0.12)
ax.axhspan(ymin, 0, color="#d62728", alpha=0.09)
ax.axhline(0, color="gray", lw=1)
ax.axhline(BUFFER, color="gray", ls="--", lw=1)
ax.text(xt[2], (BUFFER + ymax) / 2, "clears worst-case floor (room to lend OUSD)",
        fontsize=8, color="#1a7a1a", va="center")
ax.text(xt[2], BUFFER / 2, "marginal — needs borrowed OUSD to leave rebasing wallets",
        fontsize=8, color="#8a6d00", va="center")
ax.text(xt[2], ymin / 2, "below OUSD APY — value-destructive (carry-farmer risk)",
        fontsize=8, color="#a31515", va="center")
# pilot spreads: bold + faint daily
for name in PILOT_MKTS:
    c = COLORS[name]
    raw = mkt_a[name] - ousd_a
    ax.plot(xt, raw, color=c, alpha=0.12, lw=1)
    s = mkt_s[name] - ousd_s
    ax.plot(xt, s, color=c, lw=2.6,
            label=f"{name} − OUSD  30d {last_val(s):+.2f}pp (spot {last_val(raw):+.2f})  [pilot]")
# broad spreads: thin
for name in BROAD_MKTS:
    if not morpho[name]:
        continue
    s = mkt_s[name] - ousd_s
    ax.plot(xt, s, color=COLORS[name], lw=1.3, alpha=0.8,
            label=f"{name} − OUSD  {last_val(s):+.2f}pp")
ax.set_ylim(ymin, ymax)
ax.set_ylabel("spread: borrow APY − OUSD APY (pp)")
ax.set_title("OUSD credit-market spread — is there room to lend OUSD? (30-day smoothed)")
style(ax); ax.set_ylabel("spread: borrow APY − OUSD APY (pp)")
ax.legend(loc="upper right", fontsize=7, framealpha=0.92, ncol=2)
fig.tight_layout(); fig.savefig(os.path.join(OUT, "spread.png"), dpi=150); plt.close(fig)

# ===== CSV =====
import csv
cols = ["date", "ousd_apy", "ousd_peg"] + [f"{n} borrow" for n in MORPHO_MKTS] + [f"spread {n}" for n in MORPHO_MKTS]
with open(os.path.join(OUT, "data.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(cols)
    for i, day in enumerate(idx):
        row = [day.isoformat(),
               round(ousd_a[i], 4) if not np.isnan(ousd_a[i]) else "",
               round(peg_a[i], 5) if not np.isnan(peg_a[i]) else ""]
        for n in MORPHO_MKTS:
            row.append(round(mkt_a[n][i], 4) if not np.isnan(mkt_a[n][i]) else "")
        for n in MORPHO_MKTS:
            v = mkt_a[n][i] - ousd_a[i]
            row.append(round(v, 4) if not np.isnan(v) else "")
        w.writerow(row)

print("\nWROTE:", OUT)
for fn in ("overlay.png", "spread.png", "data.csv"):
    p = os.path.join(OUT, fn); print(f"  {fn}: {os.path.getsize(p)} bytes")
print("\nLatest spreads (borrow − OUSD APY), 30d | spot:")
for n in MORPHO_MKTS:
    s = mkt_s[n] - ousd_s; raw = mkt_a[n] - ousd_a
    tag = "pilot" if n in PILOT_MKTS else "broad"
    if len(s[~np.isnan(s)]):
        print(f"  [{tag}] {n}: {last_val(s):+.2f} pp | spot {last_val(raw):+.2f} pp")
