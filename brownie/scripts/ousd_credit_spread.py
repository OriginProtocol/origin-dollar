#!/usr/bin/env python3
"""
OUSD Credit-Market spread analysis — per group (collateral class on Ethereum; per chain elsewhere).

Markets = the ACTUAL sets OUSD supports on Morpho, read from the OUSD V1 MetaMorpho vaults that
each OUSD Vault V2 allocates through:
  Ethereum  V2 0xFB154c729A16802c4ad1E8f7FF539a8b9f49c960 -> V1 0x5B8b9FA8e4145eE06025F642cAdB1B47e5F39F04
  Base      V2 0x2Ba14b2e1E7D2189D3550b708DFCA01f899f33c1 -> V1 0x581Cc9a73Ec7431723A4a80699B8f801205841F1
  HyperEVM  V2 0xE90959cbE7E56b5eBFF9AD12de611A4976F2d2B1 -> V1 0x0fb7e41A0A85Eb0BcA55172b73942cc6685e2B2E

For each group writes two images to brownie/reports/ousd-credit-spread/:
  spread_<group>.png  — market USDC borrow APY − OUSD APY (pp), over the floor band
  pegadj_<group>.png  — same, with a peg-sourcing haircut applied (solid), raw spread faint

Spread: 0 line = OUSD APY; green ≥ +0.5pp clears the floor; teal columns = OUSD peg-stress days.
peg haircut(pp) = (1 − OUSD peg) × 365/HOLD_DAYS  (global OUSD peg used on every chain; chain-local
OUSD liquidity would refine the cross-chain cost — see caveats).
Run with a python that has matplotlib+numpy (e.g. /tmp/ousd-chart-venv).
"""
import json, os, time, urllib.request, urllib.error, datetime as dt
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.transforms as mtransforms

UA = {"User-Agent": "Mozilla/5.0 ousd-research"}
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "reports", "ousd-credit-spread"))
os.makedirs(OUT, exist_ok=True)

BUFFER = 0.5
WINDOW_DAYS = 365
SMOOTH = 30
WARN, BAD = 0.998, 0.995
HOLD_DAYS = 30
EXIT_FRACTION = 1.0
YMIN, YMAX = -7.0, 8.0
OUSD_POOL = "529258ee-9b27-4fcf-a32c-b82abb3fda68"

# group -> (chainId, title, {label: marketId})
GROUPS = {
    "stablecoin": (1, "Ethereum — Stablecoin / yield-stable collateral", {
        "stcUSD/USDC":         "0xeb17955ea422baeddbfb0b8d8c9086c5be7a9cfdefb292119a102e981a30062e",
        "PT-stcUSD-23JUL2026": "0x2fb3713487c7812e7309935b034f40228841666f6b048faf31fd2110ae674f20",
        "PT-cUSD-23JUL2026":   "0x702b7ec7628de2622e51e1bb34a7e6ad9e95f3a25a2ed361e4ce621f23f5e642",
        "syrupUSDC/USDC":      "0x729badf297ee9f2f6b3f717b96fd355fc6ec00422284ce1968e76647b258cf44",
    }),
    "eth": (1, "Ethereum — ETH-LST collateral", {
        "OETH/USDC":      "0xb8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e",
        "weETH/USDC":     "0x61765602144e91e5ac9f9e98b8584eae308f9951596fd7f5e0f59f21cd2bf664",
        "wstETH/USDC":    "0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc",
        "wstETH/USDC #2": "0x6d2fba32b8649d92432d036c16aa80779034b7469b63abc259b17678857f31c2",
    }),
    "btc": (1, "Ethereum — BTC collateral", {
        "WBTC/USDC":     "0x3a85e619751152991742810df6ec69ce473daef99e28a64ab2340d7b7ccfee49",
        "cbBTC/USDC":    "0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64",
        "cbBTC/USDC #2": "0xba3ba077d9c838696b76e29a394ae9f0d1517a372e30fd9a0fc19c516fb4c5a7",
        "LBTC/USDC":     "0xbf02d6c6852fa0b8247d5514d0c91e6c1fbde9a168ac3fd2033028b5ee5ce6d0",
        "tBTC/USDC":     "0xe4cfbee9af4ad713b41bf79f009ca02b17c001a0c0e7bd2e6a89b1111b3d3f08",
    }),
    "base": (8453, "Base — OUSD vault markets", {
        "cbXRP/USDC":     "0xd4a903dc6d949519060c7707f9604fdc9772c046e05c2e3a8fce0bd7196e4109",
        "superOETHb/USDC":"0x67a66cbacb2fe48ec4326932d4528215ad11656a86135f2795f5b90e501eb538",
        "wstETH/USDC":    "0x13c42741a359ac4a8aa8287d2be109dcf28344484f91185f9a79bd5a805a55ae",
        "cbETH/USDC":     "0xdba352d93a64b17c71104cbddc6aef85cd432322a1446b5b65163cbbc615cd0c",
        "cbETH/USDC #2":  "0x1c21c59df9db44bf6f645d854ee710a8ca17b479451447e9f56758aee10a2fad",
        "cbBTC/USDC":     "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836",
        "WETH/USDC":      "0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda",
    }),
    "hyperevm": (999, "HyperEVM — OUSD vault markets", {
        "kHYPE/USDC": "0xe7aa046832007a975d4619260d221229e99cc27da2e6ef162881202b4cd2349b",
        "WHYPE/USDC": "0xd13b1bad542045a8dc729fa0ffcc4f538b9771592c2666e1f09667dcf85804fc",
    }),
}
PALETTE = ["#1f77b4", "#d62728", "#2ca02c", "#9467bd", "#8c564b", "#e377c2", "#17becf", "#bcbd22"]


def get(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90))


def gql(query):
    req = urllib.request.Request("https://blue-api.morpho.org/graphql",
                                 data=json.dumps({"query": query}).encode(),
                                 headers={**UA, "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=90))
    except urllib.error.HTTPError as e:
        return {"errors": [{"http": e.code, "body": e.read().decode()[:200]}]}


def d(ts):
    if isinstance(ts, (int, float)):
        return dt.datetime.utcfromtimestamp(ts).date()
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00")).date()


# ---- OUSD APY + peg (global; OUSD is the same OToken on every chain) ----
ousd = {}
for r in get(f"https://yields.llama.fi/chart/{OUSD_POOL}")["data"]:
    if r.get("apy") is not None:
        ousd[d(r["timestamp"])] = float(r["apy"])
print(f"OUSD APY latest {ousd[sorted(ousd)[-1]]:.2f}%")
peg = {}
try:
    cg = get("https://api.coingecko.com/api/v3/coins/origin-dollar/market_chart?vs_currency=usd&days=365&interval=daily")
    for ts, px in cg.get("prices", []):
        peg[dt.datetime.utcfromtimestamp(ts / 1000).date()] = float(px)
    print(f"OUSD peg latest {peg[sorted(peg)[-1]]:.4f}")
except Exception as e:  # noqa: BLE001
    print(f"peg FAILED {e}")

# ---- per-market borrow histories (per chain) ----
E = int(time.time()); S = E - (WINDOW_DAYS + SMOOTH + 5) * 86400
morpho = {}  # group -> {label: {date: pct}}
for g, (cid, _title, mkts) in GROUPS.items():
    morpho[g] = {}
    for name, mid in mkts.items():
        q = ('{ marketById(marketId:"%s", chainId:%d){ historicalState{ '
             'borrowApy(options:{startTimestamp:%d, endTimestamp:%d, interval:DAY}){ x y } } } }' % (mid, cid, S, E))
        series = (((gql(q).get("data") or {}).get("marketById") or {}).get("historicalState") or {}).get("borrowApy")
        morpho[g][name] = {d(p["x"]): float(p["y"]) * 100 for p in (series or []) if p.get("y") is not None}
    got = sum(1 for n in mkts if morpho[g][n])
    print(f"  {g}: {got}/{len(mkts)} markets with data")

# ---- align / smooth ----
today = dt.date.today()
idx = [today - dt.timedelta(days=i) for i in range(WINDOW_DAYS - 1, -1, -1)]
xt = [dt.datetime.combine(x, dt.time()) for x in idx]


def align(series):
    out = np.full(len(idx), np.nan)
    if not series:
        return out
    keys = sorted(series); last = np.nan; j = 0
    for i, day in enumerate(idx):
        while j < len(keys) and keys[j] <= day:
            last = series[keys[j]]; j += 1
        out[i] = last
    return out


def roll(a, w=SMOOTH):
    out = np.full(len(a), np.nan)
    for i in range(len(a)):
        seg = a[max(0, i - w + 1):i + 1]; seg = seg[~np.isnan(seg)]
        if len(seg):
            out[i] = seg.mean()
    return out


def last_val(a):
    v = a[~np.isnan(a)]; return v[-1] if len(v) else float("nan")


ousd_s = roll(align(ousd))
ousd_a = align(ousd)
peg_a = align(peg)
hc_s = roll(EXIT_FRACTION * np.clip(1.0 - peg_a, 0.0, None) * (365.0 / HOLD_DAYS) * 100.0)
spread_s = {g: {n: roll(align(morpho[g][n])) - ousd_s for n in GROUPS[g][2]} for g in GROUPS}
b_a = {g: {n: align(morpho[g][n]) for n in GROUPS[g][2]} for g in GROUPS}

warn = peg_a < WARN
bad = peg_a < BAD


def spans(mask):
    out = []; i = 0; n = len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j + 1 < n and mask[j + 1]:
                j += 1
            out.append((xt[i], xt[min(j + 1, n - 1)])); i = j + 1
        else:
            i += 1
    return out


def peg_shade(ax):
    for x0, x1 in spans(bad):
        ax.axvspan(x0, x1, color="#0d7d7d", alpha=0.12, lw=0, zorder=0)
    for x0, x1 in spans(warn & ~bad):
        ax.axvspan(x0, x1, color="#0d7d7d", alpha=0.06, lw=0, zorder=0)
    tr = mtransforms.blended_transform_factory(ax.transData, ax.transAxes)
    xb = [t for t, m in zip(xt, bad) if m]
    if xb:
        ax.plot(xb, [0.012] * len(xb), "|", transform=tr, color="#0d7d7d", ms=8, mew=1.4, zorder=5)


def base_axes(ax, title, extra=""):
    ax.axhspan(BUFFER, YMAX, color="#2ca02c", alpha=0.10)
    ax.axhspan(0, BUFFER, color="#e6b800", alpha=0.12)
    ax.axhspan(YMIN, 0, color="#d62728", alpha=0.09)
    ax.axhline(0, color="gray", lw=1)
    ax.axhline(BUFFER, color="gray", ls="--", lw=1)
    ax.text(xt[2], (BUFFER + YMAX) / 2, "room to lend OUSD (clears floor)", fontsize=8, color="#1a7a1a", va="center")
    ax.text(xt[2], YMIN / 2, "below OUSD APY — value-destructive", fontsize=8, color="#a31515", va="center")
    peg_shade(ax)
    ax.set_ylim(YMIN, YMAX)
    ax.set_ylabel("spread: borrow APY − OUSD APY (pp)")
    ax.xaxis.set_major_locator(mdates.MonthLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
    ax.grid(True, alpha=0.25)
    ax.set_title(f"{title}  (0 = OUSD APY {last_val(ousd_a):.2f}%; 30d smoothed){extra}")


def clip_note(ax, series):
    cl = [n for n, s in series if np.nanmax(s) > YMAX or np.nanmin(s) < YMIN]
    if cl:
        ax.text(xt[1], YMAX - 0.3, "transient spikes beyond axis clipped: " + ", ".join(cl),
                fontsize=7, color="gray", style="italic", va="top")


for g, (cid, title, mkts) in GROUPS.items():
    names = [n for n in mkts if morpho[g][n]]
    # --- spread image ---
    fig, ax = plt.subplots(figsize=(11.5, 6.0))
    base_axes(ax, title)
    for i, n in enumerate(names):
        ax.plot(xt, spread_s[g][n], color=PALETTE[i % len(PALETTE)], lw=2.2,
                label=f"{n} − OUSD  {last_val(spread_s[g][n]):+.2f}pp  (borrow {last_val(b_a[g][n]):.2f}%)")
    clip_note(ax, [(n, spread_s[g][n]) for n in names])
    ax.legend(loc="upper right", fontsize=8, framealpha=0.92)
    fig.savefig(os.path.join(OUT, f"spread_{g}.png"), dpi=150, bbox_inches="tight"); plt.close(fig)
    # --- peg-adjusted image ---
    fig, ax = plt.subplots(figsize=(11.5, 6.0))
    base_axes(ax, title + " — peg-adjusted", extra=f"  ·  haircut = (1−peg)×365/{HOLD_DAYS}; faint = raw spread")
    for i, n in enumerate(names):
        c = PALETTE[i % len(PALETTE)]
        ax.plot(xt, spread_s[g][n], color=c, lw=1, alpha=0.22)
        adj = spread_s[g][n] - hc_s
        ax.plot(xt, adj, color=c, lw=2.2, label=f"{n} peg-adj  {last_val(adj):+.2f}pp")
    clip_note(ax, [(n, spread_s[g][n] - hc_s) for n in names])
    ax.legend(loc="upper right", fontsize=8, framealpha=0.92)
    fig.savefig(os.path.join(OUT, f"pegadj_{g}.png"), dpi=150, bbox_inches="tight"); plt.close(fig)
    # --- overlay image (absolute USDC borrow rates vs OUSD APY) ---
    fig, ax = plt.subplots(figsize=(11.5, 6.0))
    peg_shade(ax)
    ax.plot(xt, ousd_a, color="black", alpha=0.12, lw=1)
    ax.plot(xt, ousd_s, color="black", lw=2.8,
            label=f"OUSD APY  30d {last_val(ousd_s):.2f}%  (spot {last_val(ousd_a):.2f}%)")
    for i, n in enumerate(names):
        bs = spread_s[g][n] + ousd_s
        ax.plot(xt, bs, color=PALETTE[i % len(PALETTE)], lw=2.0, label=f"{n}  {last_val(bs):.2f}%")
    ax.set_ylim(0, 10); ax.set_ylabel("borrow APY (%)")
    ax.xaxis.set_major_locator(mdates.MonthLocator()); ax.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
    ax.grid(True, alpha=0.25)
    ax.set_title(f"{title} — USDC borrow rates vs OUSD APY (30d smoothed)")
    cl = [n for n in names if np.nanmax(spread_s[g][n] + ousd_s) > 10]
    if cl:
        ax.text(xt[1], 9.7, "spikes above axis clipped: " + ", ".join(cl), fontsize=7, color="gray", style="italic", va="top")
    ax.legend(loc="upper right", fontsize=8, framealpha=0.92)
    fig.savefig(os.path.join(OUT, f"overlay_{g}.png"), dpi=150, bbox_inches="tight"); plt.close(fig)

import csv
allmk = [(g, n) for g in GROUPS for n in GROUPS[g][2]]
cols = ["date", "ousd_apy", "ousd_peg"] + [f"{g}:{n} borrow" for g, n in allmk] + [f"{g}:{n} spread" for g, n in allmk]
with open(os.path.join(OUT, "data.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(cols)
    for i, day in enumerate(idx):
        row = [day.isoformat(),
               round(ousd_a[i], 4) if not np.isnan(ousd_a[i]) else "",
               round(peg_a[i], 5) if not np.isnan(peg_a[i]) else ""]
        row += [round(b_a[g][n][i], 4) if not np.isnan(b_a[g][n][i]) else "" for g, n in allmk]
        row += [round(b_a[g][n][i] - ousd_a[i], 4) if not np.isnan(b_a[g][n][i] - ousd_a[i]) else "" for g, n in allmk]
        w.writerow(row)

print(f"\nWROTE {3*len(GROUPS)} images + data.csv to {OUT}")
for g in GROUPS:
    print(f"\n{g} — spread (peg-adj) vs OUSD, 30d:")
    for n in GROUPS[g][2]:
        if morpho[g][n]:
            print(f"  {n:18} {last_val(spread_s[g][n]):+.2f}pp ({last_val(spread_s[g][n]-hc_s):+.2f}pp)")
