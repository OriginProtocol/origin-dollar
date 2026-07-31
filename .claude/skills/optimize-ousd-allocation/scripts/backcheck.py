#!/usr/bin/env python3
"""
Independent back-check of the OUSD production rebalancer.

Pulls the production rebalancer's numbers from Grafana Cloud Prometheus and
diffs them against on-chain truth (cast). The production `ousd_rebalancer_*`
series are a VERIFICATION TARGET, not a source — this script exists to confirm
the production rebalancer is working, not to trust it.

Run from `contracts/` (reads ./.env for GRAFANA_TOKEN + PROVIDER_URL):
    cd contracts && python3 ../.claude/skills/optimize-ousd-allocation/scripts/backcheck.py

Read-only. No secrets printed. Requires: python3 (stdlib), foundry `cast`.
"""
import json, subprocess, urllib.request, urllib.parse, sys, os

GRAFANA = "https://grafana.originprotocol.com/api/datasources/proxy/uid/grafanacloud-prom/api/v1/query"
USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"

# Grafana rebalancer `name` label -> (on-chain address, how to read its balance)
STRATS = {
    "Ethereum Morpho": ("0x3643cafA6eF3dd7Fcc2ADaD1cabf708075AFFf6e", "checkBalance"),
    "Base Morpho":     ("0xB1d624fc40824683e2bFBEfd19eB208DbBE00866", "checkBalance"),
    "HyperEVM Morpho": ("0xE0228DB13F8C4Eb00fD1e08e076b09eF5cD0EA1e", "checkBalance"),
    "OUSD Vault":      ("0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70", "usdcBalance"),
}
# not tracked by the production rebalancer — our skill covers it:
AMO = ("Curve OUSD/USDC AMO", "0x26a02ec47ACC2A3442b757F45E0A82B8e993Ce11", "checkBalance")

DIVERGENCE_PCT = 1.0  # flag if on-chain vs Grafana differ by more than this


def env(key, path=".env"):
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def promq(query, token):
    url = GRAFANA + "?query=" + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)["data"]["result"]


def by_name(result):
    out = {}
    for s in result:
        n = s["metric"].get("name") or s["metric"].get("strategy") or "?"
        out[n] = float(s["value"][1])
    return out


def cast_call(addr, sig, rpc, *args):
    cmd = ["cast", "call", addr, sig, *args, "--rpc-url", rpc]
    raw = subprocess.check_output(cmd, text=True).strip().split()[0]
    return int(raw)


def main():
    token, rpc = env("GRAFANA_TOKEN"), env("PROVIDER_URL")
    if not token or not rpc:
        sys.exit("Missing GRAFANA_TOKEN or PROVIDER_URL in ./.env (run from contracts/)")

    cur = by_name(promq("ousd_rebalancer_strategy_current_balance", token))
    tgt = by_name(promq("ousd_rebalancer_strategy_target_balance", token))
    dlt = by_name(promq("ousd_rebalancer_strategy_delta", token))

    print(f"{'Strategy':<20}{'on-chain':>14}{'grafana.cur':>14}{'diff%':>9}{'gf.target':>14}{'gf.delta':>12}  flag")
    print("-" * 97)
    flags = []
    for name, (addr, how) in STRATS.items():
        if how == "checkBalance":
            oc = cast_call(addr, "checkBalance(address)(uint256)", rpc, USDC) / 1e6
        else:
            oc = cast_call(USDC, "balanceOf(address)(uint256)", rpc, addr) / 1e6
        g = cur.get(name, float("nan"))
        diff = (abs(oc - g) / g * 100) if g else float("nan")
        flag = ""
        if diff == diff and diff > DIVERGENCE_PCT:
            flag = f"DIVERGES {diff:.0f}%"
            flags.append((name, oc, g))
        print(f"{name:<20}{oc:>14,.0f}{g:>14,.0f}{diff:>8.1f}%{tgt.get(name,0):>14,.0f}{dlt.get(name,0):>+12,.0f}  {flag}")

    # AMO is not in the production rebalancer — show on-chain only
    oc = cast_call(AMO[1], "checkBalance(address)(uint256)", rpc, USDC) / 1e6
    print(f"{AMO[0]:<20}{oc:>14,.0f}{'—(not tracked)':>14}{'':>9}{'':>14}{'':>12}  NOT IN REBALANCER")

    # APY snapshot
    print("\nmorpho_vault_apy (per chain, spot):")
    for s in promq("morpho_vault_apy", token):
        ch = s["metric"].get("chain") or s["metric"].get("chain_id") or "?"
        print(f"  {ch:<12}{float(s['value'][1])*100:>7.2f}%")

    print("\nVERDICT:", "production rebalancer matches on-chain ✓" if not flags
          else f"{len(flags)} divergence(s) — investigate: " + ", ".join(f[0] for f in flags))


if __name__ == "__main__":
    main()
