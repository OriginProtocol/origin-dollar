#!/usr/bin/env python3
"""
Render 3 candidate ways to fold the OUSD peg into the spread chart, for visual comparison.

Reads brownie/reports/ousd-credit-spread/data.csv (produced by ousd_credit_spread.py;
already has `ousd_peg` + all 9 markets) -> NO refetch. Writes to the same report dir:
  spread_v1_shading.png  - teal peg-stress vertical shading + bottom rug
  spread_v2_panel.png    - 2-panel: spread on top, peg strip below (mirrors Chart 1)
  spread_v3_pegadj.png   - V1 shading + dashed peg-adjusted pilot line (HOLD_DAYS knob)

Throwaway comparison helper; once a variant is chosen it gets folded into Figure 2 of
ousd_credit_spread.py.
"""
import os, csv, datetime as dt
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.transforms as mtransforms

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "reports", "ousd-credit-spread"))
BUFFER = 0.5
SMOOTH = 30
WARN, BAD = 0.998, 0.995          # peg-stress thresholds (mirror Chart 1's amber/red tops)
HOLD_LIST = [30, 60, 180]         # V3: assumed borrow holding periods (days) for amortizing peg cost
EXIT_FRACTION = 1.0              # V3: share of position that must round-trip OUSD<->USDC

PILOT = ["OETH/USDC", "wstETH/USDC"]
BROAD = ["cbBTC/USDC ·264M", "WBTC/USDC ·138M", "WETH/USDC", "weETH/USDC ·77%",
         "wstETH/USDC ·46M", "WBTC/USDC ·44M", "cbBTC/USDC ·43M", "PT-stcUSD/USDC"]
MKTS = PILOT + BROAD
PILOT_COLORS = {"OETH/USDC": "#1f77b4", "wstETH/USDC": "#ff7f0e"}
BROAD_PALETTE = ["#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#17becf", "#bcbd22", "#393b79"]
COLORS = dict(PILOT_COLORS)
for i, n in enumerate(BROAD):
    COLORS[n] = BROAD_PALETTE[i % len(BROAD_PALETTE)]
PEG_TEAL = "#0d7d7d"

# ---- read data.csv ----
rows = list(csv.DictReader(open(os.path.join(OUT, "data.csv"))))


def colf(name):
    return np.array([float(r[name]) if r.get(name) not in (None, "") else np.nan for r in rows])


dates = [dt.date.fromisoformat(r["date"]) for r in rows]
xt = [dt.datetime.combine(d, dt.time()) for d in dates]
ousd = colf("ousd_apy")
peg = colf("ousd_peg")
borrow = {n: colf(f"{n} borrow") for n in MKTS}


def roll(a, w=SMOOTH):
    out = np.full(len(a), np.nan)
    for i in range(len(a)):
        seg = a[max(0, i - w + 1):i + 1]
        seg = seg[~np.isnan(seg)]
        if len(seg):
            out[i] = seg.mean()
    return out


def lastv(a):
    v = a[~np.isnan(a)]
    return v[-1] if len(v) else float("nan")


ousd_s = roll(ousd)
b_s = {n: roll(borrow[n]) for n in MKTS}
spread_s = {n: b_s[n] - ousd_s for n in MKTS}          # 30-day smoothed spread
spread_raw = {n: borrow[n] - ousd for n in MKTS}        # daily spot spread

ymin, ymax = -2.5, 3.0


def floor_band(ax):
    ax.axhspan(BUFFER, ymax, color="#2ca02c", alpha=0.10)
    ax.axhspan(0, BUFFER, color="#e6b800", alpha=0.12)
    ax.axhspan(ymin, 0, color="#d62728", alpha=0.09)
    ax.axhline(0, color="gray", lw=1)
    ax.axhline(BUFFER, color="gray", ls="--", lw=1)
    ax.text(xt[2], (BUFFER + ymax) / 2, "room to lend OUSD", fontsize=8, color="#1a7a1a", va="center")
    ax.text(xt[2], ymin / 2, "below OUSD APY — value-destructive", fontsize=8, color="#a31515", va="center")


def spread_lines(ax):
    for n in PILOT:
        ax.plot(xt, spread_raw[n], color=COLORS[n], alpha=0.12, lw=1)
        ax.plot(xt, spread_s[n], color=COLORS[n], lw=2.6,
                label=f"{n} − OUSD  {lastv(spread_s[n]):+.2f}pp [pilot]")
    for n in BROAD:
        ax.plot(xt, spread_s[n], color=COLORS[n], lw=1.3, alpha=0.8,
                label=f"{n} − OUSD  {lastv(spread_s[n]):+.2f}pp")


def axes_style(ax):
    ax.xaxis.set_major_locator(mdates.MonthLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
    ax.grid(True, alpha=0.25)
    ax.set_ylabel("spread: borrow APY − OUSD APY (pp)")
    ax.set_ylim(ymin, ymax)


def spans(mask):
    """contiguous (start, end) datetime runs where mask is True"""
    out = []
    i, n = 0, len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j + 1 < n and mask[j + 1]:
                j += 1
            out.append((xt[i], xt[min(j + 1, n - 1)]))
            i = j + 1
        else:
            i += 1
    return out


warn = peg < WARN          # NaN -> False, so pre-inception days are ignored
bad = peg < BAD


def add_shading(ax):
    for x0, x1 in spans(bad):
        ax.axvspan(x0, x1, color=PEG_TEAL, alpha=0.12, lw=0, zorder=0)
    for x0, x1 in spans(warn & ~bad):
        ax.axvspan(x0, x1, color=PEG_TEAL, alpha=0.06, lw=0, zorder=0)
    tr = mtransforms.blended_transform_factory(ax.transData, ax.transAxes)
    xb = [t for t, m in zip(xt, bad) if m]
    if xb:
        ax.plot(xb, [0.012] * len(xb), "|", transform=tr, color=PEG_TEAL, ms=8, mew=1.4, zorder=5)


# ========== V1: shading + rug ==========
fig, ax = plt.subplots(figsize=(12.5, 6.6))
floor_band(ax)
add_shading(ax)
spread_lines(ax)
axes_style(ax)
ax.set_title("V1 — spread + peg-stress shading (teal = OUSD-discount days; rug ticks = hard depeg <0.995)")
ax.legend(loc="upper right", fontsize=7, framealpha=0.92, ncol=2)
fig.savefig(os.path.join(OUT, "spread_v1_shading.png"), dpi=150, bbox_inches="tight")
plt.close(fig)

# ========== V2: 2-panel (spread + peg strip) ==========
fig, (ax, axp) = plt.subplots(2, 1, figsize=(12.5, 7.6), sharex=True,
                              gridspec_kw={"height_ratios": [5, 1], "hspace": 0.08})
floor_band(ax)
spread_lines(ax)
axes_style(ax)
ax.tick_params(labelbottom=False)
ax.set_title("V2 — spread chart with an OUSD peg panel below (mirrors Chart 1)")
ax.legend(loc="upper right", fontsize=7, framealpha=0.92, ncol=2)
axp.axhspan(0.995, 0.998, color="#e6b800", alpha=0.12)
axp.axhspan(0.985, 0.995, color="#d62728", alpha=0.10)
axp.axhline(1.0, color="gray", ls="--", lw=1)
axp.plot(xt, peg, color=PEG_TEAL, lw=1.6)
axp.set_ylim(0.990, 1.008)
axp.grid(True, alpha=0.25)
axp.set_ylabel("OUSD peg\n($/USDC)", fontsize=8)
axp.xaxis.set_major_locator(mdates.MonthLocator())
axp.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
fig.savefig(os.path.join(OUT, "spread_v2_panel.png"), dpi=150, bbox_inches="tight")
plt.close(fig)

# ========== V3: shading + peg-adjusted pilot line, across hold assumptions ==========
disc = np.clip(1.0 - peg, 0.0, None)                       # fractional discount; premium -> 0
v3_summary = {}
for hold in HOLD_LIST:
    hc_s = roll(EXIT_FRACTION * disc * (365.0 / hold) * 100.0)   # annualized pp haircut, smoothed
    fig, ax = plt.subplots(figsize=(12.5, 6.6))
    floor_band(ax)
    add_shading(ax)
    spread_lines(ax)
    adj_last = {}
    for n in PILOT:
        adj = spread_s[n] - hc_s
        adj_last[n] = lastv(adj)
        ax.plot(xt, adj, color=COLORS[n], lw=1.8, ls=(0, (4, 2)), alpha=0.95,
                label=f"{n} peg-adj  {lastv(adj):+.2f}pp")
    hc_last = lastv(hc_s)
    ax.text(xt[2], ymin * 0.80,
            f"dashed = pilot spread after an estimated peg-sourcing haircut "
            f"(assumes {hold}-day hold, full round-trip; latest haircut ≈ {hc_last:.2f}pp)",
            fontsize=7, color="#a31515", style="italic")
    axes_style(ax)
    ax.set_title(f"V3 — peg-adjusted spread ({hold}-day hold; haircut = (1−peg) × 365/{hold})")
    ax.legend(loc="upper right", fontsize=6.5, framealpha=0.92, ncol=2)
    fig.savefig(os.path.join(OUT, f"spread_v3_pegadj_{hold}d.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)
    v3_summary[hold] = (hc_last, adj_last)

print("wrote to", OUT)
files = ["spread_v1_shading.png", "spread_v2_panel.png"] + [f"spread_v3_pegadj_{h}d.png" for h in HOLD_LIST]
for fn in files:
    p = os.path.join(OUT, fn)
    print(f"  {fn}: {os.path.getsize(p)} bytes")
print(f"\npeg-stress days: warn(<{WARN})={int(np.nansum(warn))}  hard(<{BAD})={int(np.nansum(bad))}")
print(f"raw pilot spreads: " + ", ".join(f"{n} {lastv(spread_s[n]):+.2f}pp" for n in PILOT))
print("V3 peg-adjusted pilot spreads by hold assumption (latest):")
for hold in HOLD_LIST:
    hc_last, adj_last = v3_summary[hold]
    print(f"  {hold:>3}d hold (haircut ≈ {hc_last:.2f}pp): " +
          ", ".join(f"{n} -> {adj_last[n]:+.2f}pp" for n in PILOT))
