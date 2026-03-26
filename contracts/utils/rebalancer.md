# OUSD Rebalancer

The rebalancer moves USDC between OUSD strategies to maximise yield.
An off-chain operator (OpenZeppelin Defender) calls `buildRebalancePlan` periodically,
then submits the resulting strategy/amount arrays to the on-chain `RebalancerModule`.

## How it works

### 1. Compute ideal allocation (`computeIdealAllocation`)

Determines the ideal target balance for each strategy, ignoring real-world constraints.

- Sorts strategies by APY descending and fills each up to `maxPerStrategyBps`
- Ensures the default strategy always receives at least `minDefaultStrategyBps`
- Reserves `shortfall + minVaultBalance` as idle vault cash — never deployed
- Strategies with APY above `maxApyThreshold` are excluded from allocation (frozen at current balance) and flagged as suspicious

### 2. Filter executable actions (`buildExecutableActions`)

Applies constraints to produce only executable moves.

**Withdrawal filtering**
Drop any move that is:
- Blocked by insufficient on-chain liquidity. Withdrawable amounts are fetched via
  `IStrategy.maxWithdraw()` for same-chain strategies and via
  `IStrategy.platformAddress().maxWithdraw(vaultAddress)` for cross-chain strategies.
  If the withdrawable amount is below `minMoveAmount` the move is dropped entirely;
  otherwise the withdrawal is capped at the available liquidity.
- Below `minMoveAmount` (after any liquidity cap)
- Cross-chain and below `crossChainMinAmount`
- From a strategy whose APY underperforms the best by less than `minApySpread`

Approved withdrawals unlock budget for deposits.

**Deposit allocation**
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

The Defender Action always calls `processWithdrawalsAndDeposits`. Either array may be
empty — the contract loops over zero entries without reverting.

If there is a cross-chain withdrawal, deposit arrays are passed empty so deposits are
deferred until the bridge settles on the next run.

Cross-chain amounts are capped at 10 M USDC (CCTP bridge limit).

---

## Strategy config (`rebalancer-config.js`)

| Field | Description |
|-------|-------------|
| `name` | Human-readable label |
| `address` | Strategy address on mainnet |
| `morphoVaultAddress` | MetaMorpho V1 vault address used for APY lookup via the Morpho GraphQL API. Must be the inner MetaMorpho V1 vault, **not** a VaultV2 wrapper — the Morpho API does not index VaultV2. Derived via: `VaultV2(outerVaultAddr).adapters(0)` → adapter; `adapter.morphoVaultV1()`. |
| `morphoChainId` | Chain where the Morpho vault lives (1 = Ethereum, 8453 = Base, 999 = HyperEVM) |
| `isCrossChain` | If it's a CrossChain strategy using CCTP |
| `isDefault` | Fallback strategy — exactly one per config |

The allocations table printed at runtime includes an `Avail.` column showing the
withdrawable liquidity fetched from each strategy, and a `Target (rec.)` column showing
the recommended (feasible) target balance after all constraints are applied.

---

## Constraints (`ousdConstraints`)

| Field | Value | Meaning |
|-------|-------|---------|
| `minDefaultStrategyBps` | 500 | Default strategy always gets ≥ 5 % of deployable capital |
| `maxPerStrategyBps` | 9500 | No single strategy gets > 95 % |
| `minMoveAmount` | $5 K USDC | Minimum size for any rebalancing move |
| `crossChainMinAmount` | $25 K USDC | Minimum for a cross-chain transfer (bridge overhead) |
| `minVaultBalance` | $3 K USDC | Idle reserve always kept in the vault |
| `minApySpread` | 0.5 % | Minimum APY improvement required to trigger a withdrawal |
| `maxApyThreshold` | 50 % | APY above this is treated as suspicious — strategy is frozen in place |
