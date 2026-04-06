# Morpho Vault APY & Deposit Impact — API Reference

This document explains how to fetch APY data and simulate deposit impact for MetaMorpho
vaults used by the OUSD rebalancer. All data is served by the Origin Subsquid indexer.

---

## Table of Contents

1. [GraphQL API](#1-graphql-api)
   - [Endpoint & Configuration](#11-endpoint--configuration)
   - [morphoVaultApy — Current Vault APY](#12-morphovaultapy--current-vault-apy)
   - [morphoVaultApyAverage — Time-Weighted Average](#13-morphovaultapyaverage--time-weighted-average)
   - [morphoDepositImpact — Simulate Deposit](#14-morphodepositimpact--simulate-deposit)
   - [Raw Indexed Data](#15-raw-indexed-data)
2. [Supported Vaults](#2-supported-vaults)
3. [How the Indexer Computes APY (Reference)](#3-how-the-indexer-computes-apy-reference)
   - [Architecture](#31-architecture)
   - [Morpho Adaptive Curve IRM](#32-morpho-adaptive-curve-irm)
   - [Weighted Vault APY](#33-weighted-vault-apy)
   - [Deposit Impact Simulation](#34-deposit-impact-simulation)
   - [Key Design Decisions](#35-key-design-decisions)

---

## 1. GraphQL API

### 1.1 Endpoint & Configuration

```
https://origin.squids.live/origin-squid:prod/api/graphql
```

In the OUSD rebalancer, the URL is read from the `ORIGIN_SUBSQUID_SERVER` environment
variable (with the above URL as the default fallback). In OpenZeppelin Defender, set
this as a secret named `ORIGIN_SUBSQUID_SERVER`.

### 1.2 `morphoVaultApy` — Current Vault APY

Returns the current instantaneous supply APY for a MetaMorpho vault.

```graphql
query {
  morphoVaultApy(
    chainId: 999,
    vaultAddress: "0x0fb7e41a0a85eb0bca55172b73942cc6685e2b2e"
  )
}
```

**Arguments:**
| Name | Type | Description |
|---|---|---|
| `chainId` | `Int!` | Chain ID (1 = Ethereum, 8453 = Base, 999 = HyperEVM) |
| `vaultAddress` | `String!` | MetaMorpho V1.1 vault address (lowercase) |

**Returns:** `Float!` — APY as a decimal (e.g. `0.0479` = 4.79%)

### 1.3 `morphoVaultApyAverage` — Time-Weighted Average

Returns the time-weighted average APY over a configurable window.

```graphql
query {
  morphoVaultApyAverage(
    chainId: 999,
    timeWindow: "6h",
    vaultAddress: "0x0fb7e41a0a85eb0bca55172b73942cc6685e2b2e"
  ) {
    averageApy
    timeWindowHours
  }
}
```

**Arguments:**
| Name | Type | Description |
|---|---|---|
| `chainId` | `Int!` | Chain ID |
| `vaultAddress` | `String!` | MetaMorpho V1.1 vault address (lowercase) |
| `timeWindow` | `String!` | Duration string: `"1h"`, `"6h"`, `"24h"`, `"7d"`, etc. |

**Returns:**
| Field | Type | Description |
|---|---|---|
| `averageApy` | `Float!` | Time-weighted average APY as a decimal |
| `timeWindowHours` | `Float!` | Actual window in hours (e.g. `168` for `"7d"`) |

### 1.4 `morphoDepositImpact` — Simulate Deposit

Simulates depositing into a vault and returns the resulting APY change.

```graphql
query {
  morphoDepositImpact(
    chainId: 999,
    vaultAddress: "0x0fb7e41a0a85eb0bca55172b73942cc6685e2b2e",
    depositAmount: "10000000000000"
  ) {
    currentApy
    newApy
    impactBps
  }
}
```

**Arguments:**
| Name | Type | Description |
|---|---|---|
| `chainId` | `Int!` | Chain ID |
| `vaultAddress` | `String!` | MetaMorpho V1.1 vault address (lowercase) |
| `depositAmount` | `String!` | Amount in **native token decimals** as a string (e.g. `"10000000000000"` = 10M USDC with 6 decimals) |

**Returns:**
| Field | Type | Description |
|---|---|---|
| `currentApy` | `Float!` | Pre-deposit APY as a decimal |
| `newApy` | `Float!` | Post-deposit APY as a decimal |
| `impactBps` | `Int!` | APY decrease in basis points (always >= 0; a deposit can only dilute yield) |

### 1.5 Raw Indexed Data

The indexer also exposes historical snapshots for granular analysis:

**`morphoVaultApies`** — historical vault APY snapshots:
- Fields: `id`, `chainId`, `timestamp`, `blockNumber`, `vaultAddress`, `apy`

**`morphoMarketStates`** — per-market state over time:
- Fields: `id`, `chainId`, `timestamp`, `blockNumber`, `marketId`, `totalSupplyAssets`, `totalSupplyShares`, `totalBorrowAssets`, `totalBorrowShares`, `lastUpdate`, `fee`

Both support standard filtering (`where`), pagination (`limit`, `offset`), and ordering (`orderBy`).

---

## 2. Supported Vaults

### Morpho Blue (singleton per chain)

| Chain | chainId | Address |
|---|---|---|
| Ethereum | 1 | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
| Base | 8453 | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
| HyperEVM | 999 | `0x68e37dE8d93d3496ae143F2E900490f6280C57cD` |

> HyperEVM uses a non-canonical MorphoBlue deployment.

### MetaMorpho V1.1 Vaults (pass these as `vaultAddress`)

| Chain | chainId | MetaMorpho V1.1 Vault |
|---|---|---|
| Ethereum | 1 | `0x5B8b9FA8e4145eE06025F642cAdB1B47e5F39F04` |
| Base | 8453 | `0x581Cc9a73Ec7431723A4a80699B8f801205841F1` |
| HyperEVM | 999 | `0x0fb7e41A0A85Eb0BcA55172b73942cc6685e2B2E` |

### Outer VaultV2 Wrappers (context only)

The APY API reads directly from the MetaMorpho V1.1 vaults above. The VaultV2 wrappers
and adapters are listed for reference, in case you need to derive the V1 vault address:

```
VaultV2(outerVaultAddr).adapters(0)  -> adapterAddr
Adapter(adapterAddr).morphoVaultV1() -> metaMorphoVaultAddress
```

| Chain | VaultV2 | Adapter |
|---|---|---|
| Ethereum | `0xFB154c729A16802c4ad1E8f7FF539a8b9f49c960` | `0xD8F093dCE8504F10Ac798A978eF9E0C230B2f5fF` |
| Base | `0x2Ba14b2e1E7D2189D3550b708DFCA01f899f33c1` | `0xFE4ccb1f0d9634F3191cA45B7f3413c4ca85086E` |
| HyperEVM | `0xE90959cbE7E56b5eBFF9AD12de611A4976F2d2B1` | `0xF912d9489DEc1593D888eb680a4074f84c44413c` |

---

## 3. How the Indexer Computes APY (Reference)

This section documents the math behind the indexer for anyone who needs to understand
or verify the numbers. You do not need to implement this — use the GraphQL API above.

### 3.1 Architecture

```
MetaMorpho V1.1 vault  (has supplyQueue + withdrawQueue)
  +-- Morpho Blue market A  (loanToken, IRM, utilisation -> yield)
  +-- Morpho Blue market B
  +-- ...
```

The vault's APY is a **position-weighted average** of the supply APY across every Morpho
Blue market where the vault has deployed funds.

Both the `supplyQueue` and `withdrawQueue` are scanned. A market removed from the supply
queue may still have a large active position in the withdraw queue — ignoring it would
undercount the vault's APY.

### 3.2 Morpho Adaptive Curve IRM

Each Morpho Blue market uses an Adaptive Curve IRM. The key on-chain value is
`rateAtTarget` (per second, WAD-scaled `int256`) — the borrow rate at 90% utilisation.

```
TARGET_UTIL = 0.9
STEEPNESS   = 4
WAD         = 1e18
SECONDS_PER_YEAR = 365 * 24 * 3600

curve(util):
  if util < TARGET_UTIL:  STEEPNESS * (util - TARGET_UTIL) / TARGET_UTIL
  else:                   STEEPNESS * (util - TARGET_UTIL) / (1 - TARGET_UTIL)

ratePerSec = rateAtTarget / WAD
borrowRate = ratePerSec * exp(curve(util))
borrowApy  = exp(borrowRate * SECONDS_PER_YEAR) - 1    // continuous compounding
supplyApy  = borrowApy * util * (1 - fee / WAD)        // suppliers earn util% minus protocol fee
```

Notes:
- `util` is clamped to `min(borrows/supply, 0.9999)` to handle floating-point edge cases
  where accumulated interest causes `borrows > supply`.
- `fee` is the **Morpho Blue protocol fee**, not the MetaMorpho vault's performance fee.
  The returned APY is gross before vault-level fees.
- `rateAtTarget` can be negative for distressed markets — treated as 0 APY.
- Each market has its **own IRM contract** (`morpho.idToMarketParams(id)[3]`). Some older
  IRMs return `rateAtTarget=0` despite active borrows — these are logged as suspicious
  and contribute 0 APY to the weighted average.

### 3.3 Weighted Vault APY

```
vaultApy = SUM(supplyApy_i * vaultSupplyAssets_i) / SUM(vaultSupplyAssets_i)
```

- Weight = vault's supply position in each market (shares converted to assets).
- Markets with zero vault position are skipped.
- Throws if the vault has no position in any market (misconfiguration).
- Returns 0 if both queues are empty (vault not yet deployed).

### 3.4 Deposit Impact Simulation

New deposits flow through the **supply queue in order**, filling each market up to its
cap. The simulation:

1. Iterates supply-queue markets in order
2. For each market: `available = cap - vaultSupplyAssets`
3. Fills `min(remaining, available)` into each market
4. Computes `newApy = weightedApy(markets, simulatedExtraSupply)`
5. `impactBps = round((currentApy - newApy) * 10000)`

`impactBps` is always >= 0 — a deposit can only add supply, which lowers utilisation
and therefore lowers rates.

### 3.5 Key Design Decisions

**BigNumber -> JS Number conversion**: On-chain values are `ethers.BigNumber`. The IRM
math requires floating-point (exponentials, fractions). Conversion uses
`Number(bn.toString()) / scale` (not `bn.toNumber()`, which throws for values above
`Number.MAX_SAFE_INTEGER`). Precision loss is acceptable for APY percentage calculations.

**Both queues**: Supply queue + withdraw queue are unioned and deduplicated. Each market
carries an `inSupplyQueue` flag. APY weighting uses all markets; deposit simulation uses
only supply-queue markets.

**Vault-level fees not included**: The `fee` from `morpho.market(id)` is the Morpho Blue
protocol fee. MetaMorpho vaults can charge an additional performance fee on yield. The
indexer computes gross supply APY. For net-of-fees display, use Morpho's own API
(`api.morpho.org/graphql` → `vaultByAddress.state.netApy`).

**Withdrawal APY impact not modeled**: When the rebalancer withdraws from a Morpho vault,
the remaining depositors see slightly higher APY (less supply competing for the same borrow
demand). This effect is intentionally not modeled — the rebalancer uses pre-withdrawal APYs
for source strategies. This is a conservative simplification: if the move looks worthwhile
using current APYs, it's at least as worthwhile after the source APY improves.
