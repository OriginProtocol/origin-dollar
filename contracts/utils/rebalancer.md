# OUSD Rebalancer

The rebalancer moves USDC between OUSD strategies to maximise yield.
An off-chain operator (OpenZeppelin Defender) calls `buildRebalancePlan` periodically,
then submits the resulting strategy/amount arrays to the on-chain `RebalancerModule`.

## How it works

### 1. Compute optimal allocation (`computeOptimalAllocation`)

Determines the ideal target balance for each strategy, ignoring real-world constraints.

- Sorts strategies by APY descending and fills each up to `maxPerChainBps`
- Ensures the default strategy always receives at least `minDefaultStrategyBps`
- Reserves `shortfall + minVaultBalance` as idle vault cash — never deployed
- AMO strategies are untouched (their balance is not managed here)

### 2. Filter Executable actions (`buildExecutableActions`)

Applies constraints to produce only executable moves.

**Pass A — Withdrawals**
Drop any move that is:
- Below `minMoveAmount`
- Cross-chain and below `crossChainMinAmount`
- From a strategy whose APY underperforms the best by less than `minApySpread`

Approved withdrawals unlock budget for deposits.

**Pass B — Deposits**
Fund the highest-APY strategies first from available budget
(`approved_withdrawals + vault_surplus`). Trim to budget; discard if trimmed
below the minimum size. Skip cross-chain if a transfer is already pending.

**Fallbacks**
- *Shortfall*: If the withdrawal queue has a shortfall and no withdrawal was approved,
  force a withdrawal from the default strategy (or lowest-APY cross-chain if the
  default can't cover it).
- *Surplus*: If the vault has idle surplus and no deposit was approved, deposit it
  to the default strategy.

### 3. Execute (`RebalancerModule.sol`)

The Defender Action picks the right module call:

| Situation | Call |
|-----------|------|
| Any cross-chain withdrawal | `processWithdrawals` only — deposits deferred until bridge settles |
| All same-chain, both directions | `processWithdrawalsAndDeposits` (single tx) |
| Withdrawals only | `processWithdrawals` |
| Deposits only | `processDeposits` |

Cross-chain amounts are capped at 10 M USDC (CCTP bridge limit).

---

## Strategy config (`rebalancer-config.js`)

| Field | Description |
|-------|-------------|
| `name` | Human-readable label |
| `address` | Strategy address |
| `morphoVaultAddress` | Morpho Vault used for APY lookup |
| `morphoChainId` | Chain where the Morpho vault lives (1 = Ethereum, 8453 = Base) |
| `isCrossChain` | If it's a CrossChain strategy using CCTP |
| `isDefault` | Fallback strategy — exactly one per config |
| `isAmo` | AMO strategy — balance preserved, never rebalanced |

---

## Constraints (`ousdConstraints`)

| Field | Value | Meaning |
|-------|-------|---------|
| `minDefaultStrategyBps` | 2000 | Default strategy always gets ≥ 20 % of deployable capital |
| `maxPerChainBps` | 7000 | No single chain gets > 70 % |
| `minMoveAmount` | $5 K USDC | Minimum size for any rebalancing move |
| `crossChainMinAmount` | $25 K USDC | Minimum for a cross-chain transfer (bridge overhead) |
| `minVaultBalance` | $3 K USDC | Idle reserve always kept in the vault |
| `minApySpread` | 0.5 % | Minimum APY improvement required to trigger a withdrawal |
