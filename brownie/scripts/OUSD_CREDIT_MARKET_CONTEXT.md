# OUSD Credit Market — Working Context (handoff)

_Last updated: 2026-06-23. Purpose: resume this research cold without re-deriving everything._

## TL;DR
Research + tooling for an **OUSD Credit-Market AMO**: mint OUSD, supply it as the sole lender into a deposit-gated Morpho Vault V2, let borrowers post collateral and borrow OUSD; interest reaches OUSD holders as rebase yield, and everything withdrawn is **burned** (the book can only shrink). Smart-contract work landed in **PR #2927**. Most of my effort has been a **spread/feasibility analysis** (is there room to lend OUSD?) backed by a local Python charting script and three Notion docs.

**Feasibility verdict (2026-06-23):** sound mechanism, but **out-of-the-money today and size-constrained — keep built and dormant, don't deploy capital now.** OUSD's rebase makes its rate floor ≈ its own APY (~5%), so unlike non-rebasing msUSD it can't lend cheaply; only Ethereum yield-bearing **stablecoin** markets clear the 30d floor (and only ~flat after the peg haircut, partly Cap-airdrop-driven), while the markets that clear comfortably (Base cbXRP, HyperEVM HYPE) are the riskiest to unwind. **The binding limit is liquidity, not rate:** live extractable USDC is only ~$510K (Curve pool) + ~$2.7K (unreserved vault) → safe `mintCap` ~$100–250K. Flips positive only if OUSD/USDC liquidity gets multiples deeper or the Ethereum spread structurally reopens above the floor. (Full verdict added to the Feasibility Notion doc; also note the `burnForStrategy` `whenNotCapitalPaused` unwind gap to fix before any deploy.)

## Notion docs (canonical sources — fetch via Notion MCP, not WebFetch)
1. **OUSD Credit Market Idea** (original spec) — https://app.notion.com/p/originprotocol/OUSD-Credit-Market-Idea-35a84d46f53c80799842c5d7278f75b7
   - page id `35a84d46f53c80799842c5d7278f75b7`. Contract spec, 6 rules, scenarios S1–S8, mint→Morpho→burn, "phantom backing", pilot-selection rubric.
2. **Metronome research & OUSD credit-market comparison** — https://app.notion.com/p/originprotocol/Metronome-research-and-OUSD-credit-market-comparison-38384d46f53c809b8425dd00c74c2c63
   - page id `38384d46f53c809b8425dd00c74c2c63`. msUSD is a live ~$21M version of the idea.
3. **OUSD Credit Market Feasibility — yield split / profitability research** (renamed from "OUSD Credit Market Split") — https://app.notion.com/p/originprotocol/OUSD-Credit-Market-Feasibility-yield-split-profitability-research-38384d46f53c80a898e7fd4ac2467353?d=38484d46f53c80f9900c001c1a329da9#952925e5094048e483efd320906fa4f6
   - page id `38384d46f53c80a898e7fd4ac2467353`. The spread go/no-go analysis; I've been editing this one heavily (rate-spine explanation, snapshot table, Chart 1/2/3). **Has an open inline comment** (see Open items).

## The core idea
- An AMO mints OUSD into an **Origin-owned, deposit-gated Morpho Vault V2** ("credit vault", asset = OUSD). Only the strategy can deposit.
- Borrowers post their own collateral, borrow the OUSD. Interest accrues to the position → OUSD holders via rebase.
- The strategy **only mints OUSD in and burns OUSD out** — never touches the backing asset (USDC). crvUSD/GHO model.
- **Phantom backing:** `checkBalance` reports full live position value (keeps rebase correct) but the strategy provides **zero redemption capacity** — it can only burn OUSD. So `mintCap` is effectively a claim on the Vault's redeemable reserves; operate `mintCap ≤ real 24h-extractable USDC liquidity`.
- Key rules: yield-first accounting (interest drawn before principal); losses recognize instantly; cap by what can be *unwound* not lent; minting is manual/rare; the receivable is "par for solvency, zero for liquidity".

## The economics — the rate spine
**`OUSD APY  <  OUSD borrow rate  <  USDC borrow rate`**
- **OUSD borrow rate < USDC borrow rate** → attractive to borrowers (quote inside the USDC spread; cheaper or nobody switches).
- **OUSD borrow rate > OUSD APY** → accretive not dilutive. Circulating OUSD still pays holders the rebase (cost of capital); lending below OUSD APY drags the blended APY and invites carry-farmers.
- The market only has room when **USDC borrow − OUSD APY > floor buffer** (BUFFER = 0.5pp). That gap is the **spread** the Feasibility doc charts; it is the *width* OUSD borrow rate must fit inside. No gap → stay idle (opportunistic by design).
- **Refinement:** true floor = `OUSD APY × parked_fraction + buffer` — only borrowed OUSD that lands in *rebasing* wallets actually costs the rebase. Worst case parked_fraction = 1. (OUSD makes contracts non-rebasing by default, so OUSD sold into pools/contracts is ~costless.)
- **V3 peg-adjustment:** a soft peg raises OUSD→USDC sourcing/liquidation cost — an implicit surcharge. Modeled as `haircut(pp) = (1 − peg) × 365 / hold_days`, subtracted from the spread. Sensitive to hold period (the one "invented knob"): 30d ≈ 0.6–0.8pp, 60d ≈ 0.3–0.4pp, 180d ≈ 0.1pp.

**Units discipline (verified):** rates are %, spreads are **pp** (percentage points) = bp/100. DefiLlama `apy` is already %; Morpho `borrowApy` is a fraction (×100). Both land in %, so spread = pp. Don't say "0.3%" for a 0.3pp spread.

## PR #2927 — CreditMarketAMOStrategy (branch `shah/credit-market-amo`)
- New generic `CreditMarketAMOStrategy.sol` (oToken/hardAsset/creditVault immutable → serves OUSD or OETH; wired for OUSD).
- `mintAndSupply` / `redeemAndBurn` are **Governor-or-Strategist**; `withdrawAll` tolerates illiquidity. `netMinted` tracks principal, bounded by `mintCap` (yield-first: `netMinted ≤ positionValue()`).
- **`checkBalance` = `positionValue().scaleBy(...)` = `creditVault.previewRedeem(shares)`** — full claim incl. accrued interest; **does NOT drop at high utilization**. So **accrued yield is observable via checkBalance BEFORE the borrower repays** (confirmed; doc Rule 5). Losses recognize instantly too (symmetric).
- Rails: `IVault.mintForStrategy/burnForStrategy` (VaultCore.sol:111/143) require `isSupported` + `isMintWhitelistedStrategy`; the **old global net-mint threshold is deprecated** → **`mintCap` is the ONLY on-chain bound**, and it's Strategist-settable. `burnForStrategy` is `whenNotCapitalPaused` (slight tension with "unwind in every state").
- `deposit/withdraw` revert (Vault never sends backing to a credit AMO). Merkl claim extracted to `AbstractMerkleClaimStrategy` (shared w/ Generalized4626Strategy).
- Deploy: **201** (proxy first) + **202** (impl+register, `forceSkip:true` until the gated credit vault exists; governor = Timelock; `mintCap` starts 0). `addresses.mainnet.OUSDCreditMarketVault` = placeholder `zero`.

## Metronome / msUSD — the key comparison
- msUSD (Metronome, MIP-24) is a **live ~$21M production version** of this exact idea: treasury mints msUSD, supplies ~100% into its own curated MetaMorpho vault (`gtmsUSDc` `0x6859B34a9379122d25A9FA46f0882d434fee36c3`), against yield-bearing **stablecoin** collateral (siUSD 96%, sUSDe), earns the spread.
- **Decisive asymmetry: msUSD does NOT rebase; OUSD does.** Metronome's float costs ~0 → lends profitably at 3.1%. OUSD's floor ≈ OUSD APY. So 3.1% is a guaranteed loss for OUSD; the rate-floor apparatus is the necessary tax for being a rebasing token.
- Takeaways: pilot with **yield-bearing-stablecoin collateral** (not OETH/WBTC); 91.5% LLTV only works for stable/stable; trading-fee income is *not* enough (pools are peg infra, lending is P&L); no-open-redemption makes their peg cheap to defend; the real constraint is **24h-extractable USDC liquidity** (CCTP makes chain location ~free — "extraction not transport"). Caveat: their book is largely a pre-TGE airdrop farm → size to *durable* carry.

## De-peg / looping risk (my analysis)
The loop = borrow OUSD → dump on the Curve OUSD/USDC pool for USDC. Concerns: it **drains protocol-owned USDC** (the pool funds borrowers' exit), **converts liquid USDC backing into illiquid credit receivables**, can trigger **reflexive minting spirals** (credit-side, Curve-side, cross-AMO), and **LP flight shrinks the very liquidity the cap was sized against**. The credit AMO's "only shrink/burn" safety does NOT protect the pool (only repayment pulls borrowed OUSD back). Mitigations: cap on non-POL executable depth; unified cross-AMO mint budget; pool-imbalance-aware mint gate; correct Curve defense direction; sell-velocity monitoring (not just parked-share — closes the S1b gap); robust OUSD oracle in the markets so depeg can't suppress liquidations.

## Spread analysis tooling (scripts + this doc live in `brownie/scripts/` = trackable; `brownie/reports/` is gitignored, charts/data are regenerable)
- **Main:** `brownie/scripts/ousd_credit_spread.py` → writes **3 per-class spread charts** `spread_stablecoin.png` (+ peg-adjusted dashed lines), `spread_eth.png`, `spread_btc.png`, plus `data.csv`, to `brownie/reports/ousd-credit-spread/`. Markets = OUSD's actual 13 (above), grouped by collateral class so no chart is overwhelming. Spread chart: 0-line = OUSD APY, green/amber/red floor band, teal peg-stress shading.
  - OUSD APY: DefiLlama pool `529258ee-9b27-4fcf-a32c-b82abb3fda68` (chart endpoint).
  - Morpho borrow: Blue API `https://blue-api.morpho.org/graphql` `marketById(...).historicalState.borrowApy` (DAY).
  - OUSD peg: CoinGecko `origin-dollar` market_chart (proxy for Curve pool); OUSD token `0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86`. Current Curve spot via Origin MCP `get_amo_pool_price`.
  - Aave/Compound: DefiLlama `/lendBorrow` CURRENT only (pools `aa70268e-…` / `7da72d09-…`); **historical-borrow endpoint is paywalled (402)**.
  - 30-day trailing smoothing; floor band green ≥+0.5 / amber 0–0.5 / red <0.
- **Variants (obsolete):** `ousd_credit_spread_pegvariants.py` produced the earlier all-markets V1/V2/V3 spread variants (shading / peg-panel / peg-adjusted hold-30-60-180). Superseded by the per-class split above — safe to delete. The peg-adjusted idea now lives inside the stablecoin chart.
- **venv:** `/tmp/ousd-chart-venv/bin/python` (matplotlib+numpy). **May need recreating** if /tmp is cleared: `python3 -m venv /tmp/ousd-chart-venv && /tmp/ousd-chart-venv/bin/pip install matplotlib numpy`.
- `FINDINGS.md` (older 2-market summary) also in the report dir.

## Current read (moves daily — re-run before quoting)
The **stablecoin class is the only one clearing the floor.** Latest 30d spreads vs OUSD APY (by class):
- **Stablecoin:** PT-cUSD **+0.94**, stcUSD **+0.86**, PT-stcUSD **+0.37** (all clear floor); syrupUSDC −1.31. Peg-adjusted (30d hold) they tighten to ~flat: stcUSD +0.05, PT-cUSD +0.13, PT-stcUSD −0.44 → room is real but thin once peg-sourcing cost is priced in.
- **ETH:** all sub-floor — OETH −0.10 (closest), weETH −0.36, wstETH −0.70 / −2.05.
- **BTC:** all red — −0.48 … −2.05 (tBTC least negative).
- OUSD peg healthy (~0.999, Curve on peg). Aave ~3.9% / Compound ~3.9% USDC borrow (reference only).

## Markets OUSD actually supports (Morpho Blue, mainnet, USDC loan) — marketIds
Source of truth: the **OUSD V1 MetaMorpho vault `0x5B8b9FA8e4145eE06025F642cAdB1B47e5F39F04`**, which the **OUSD Vault V2 `0xFB154c729A16802c4ad1E8f7FF539a8b9f49c960`** allocates 100% through (via a MetaMorpho adapter `0xD8F093…`). 13 markets + idle; **currently funded: OETH ~$3.05M + stcUSD ~$0.26M** (= the vault's ~$3.3M total). Grouped by collateral class (= how the charts are split):
- **Stablecoin / yield-stable** (the pilot-relevant class):
  - stcUSD/USDC (91.5%): `0xeb17955ea422baeddbfb0b8d8c9086c5be7a9cfdefb292119a102e981a30062e`  ← funded ~$0.26M; the non-dated spot stcUSD market
  - PT-stcUSD-23JUL2026 (91.5%): `0x2fb3713487c7812e7309935b034f40228841666f6b048faf31fd2110ae674f20`
  - PT-cUSD-23JUL2026 (91.5%): `0x702b7ec7628de2622e51e1bb34a7e6ad9e95f3a25a2ed361e4ce621f23f5e642`
  - syrupUSDC/USDC (91.5%): `0x729badf297ee9f2f6b3f717b96fd355fc6ec00422284ce1968e76647b258cf44`
- **ETH LSTs:**
  - OETH/USDC (86%): `0xb8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e`  ← funded ~$3.05M
  - weETH/USDC (86%): `0x61765602144e91e5ac9f9e98b8584eae308f9951596fd7f5e0f59f21cd2bf664`
  - wstETH/USDC (86%): `0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc`
  - wstETH/USDC #2 (86%): `0x6d2fba32b8649d92432d036c16aa80779034b7469b63abc259b17678857f31c2`
- **BTC:**
  - WBTC/USDC (86%): `0x3a85e619751152991742810df6ec69ce473daef99e28a64ab2340d7b7ccfee49`
  - cbBTC/USDC (86%): `0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64`
  - cbBTC/USDC #2 (86%): `0xba3ba077d9c838696b76e29a394ae9f0d1517a372e30fd9a0fc19c516fb4c5a7`
  - LBTC/USDC (86%): `0xbf02d6c6852fa0b8247d5514d0c91e6c1fbde9a168ac3fd2033028b5ee5ce6d0`
  - tBTC/USDC (77%): `0xe4cfbee9af4ad713b41bf79f009ca02b17c001a0c0e7bd2e6a89b1111b3d3f08`

**⚠️ Corrected 2026-06-22:** the first chart set used a generic blue-chip screenshot, not OUSD's book. 5 were the WRONG markets and were dropped: WETH/USDC (`0x94b823…`, OUSD has no WETH), weETH ·77% (`0x34377f…`, OUSD uses the 86% one), and public-allocator dups WBTC ·44M (`0x09dc9e…`), wstETH ·46M (`0x7e585a…`), cbBTC ·43M (`0xbc99de…`). Only 5 of the original 10 were genuine OUSD markets.

## stcUSD & Pendle
- **stcUSD = Cap protocol's** yield-bearing stablecoin (staked cUSD); reserves deployed mainly into Aave; heavy airdrop farm ("Caps" points). So demand is partly incentive-driven (may thin at Cap TGE).
- **Pendle** splits a yield token into **PT** (redeems 1:1 at maturity → fixed yield; this is the Morpho collateral) and **YT** (the yield stream + points), both **expiring** on a fixed date. Pools roll to new maturities.
- stcUSD on Pendle: only **23JUL2026** active now (PT `0x2d3c…0b83`); a **29JAN2026** market already expired (rollover precedent). New Cap-family maturities being listed → a successor stcUSD maturity is likely but **not guaranteed** (incentive-dependent).
- **Better target:** the **non-dated spot `stcUSD/USDC` Morpho market** (no maturity to roll, ~7.34% borrow) sidesteps the PT-expiry problem.

## Open items / next steps
1. **Reply to the Notion comment** on the Feasibility doc's "Current snapshot" (commenter `03fb626e-08e0-4068-a39b-96f4713810eb`, 2026-06-19). Three asks: (a) why Aave/Compound? → demote/drop (not deployment venues); (b) chart **all** Morpho-Ethereum markets we support → enumerate `MorphoOUSDv2Vault` (`0xFB154c729A16802c4ad1E8f7FF539a8b9f49c960`) allocations; (c) add **non-Ethereum (Base etc.) Morpho markets** as the cost of USDC liquidity to defend the peg.
2. **stcUSD decision:** promote PT-stcUSD to a bold "pilot" line, and/or swap the dated PT for the **non-dated spot stcUSD/USDC** market (recommended — maturity-proof, higher rate).
3. Fold the chosen **V3 hold** (and/or V2) into the main script so `spread.png` is the default; retire/flag the variants script.
4. **Manual step:** regenerated chart PNGs must be **dragged into Notion by the user** — the Notion MCP cannot upload files. (User has been doing this.)

## Gotchas / constraints
- **Notion MCP: no image upload.** Text/table edits work; images are manual drags. Use `update_content` with clean ASCII anchors; the snapshot table has unicode (`−` U+2212, `·` U+00B7, em-dash) — match exactly or edits fail.
- DefiLlama historical borrow = 402 paywalled (Aave/Compound current-only).
- `/tmp` venv is ephemeral. `brownie/reports/` (charts/data) is gitignored; the scripts + this doc are in `brownie/scripts/` — `git add` them to version-control the work.
- Today's date drifts across sessions; snapshot numbers move with live data — re-run before quoting.
