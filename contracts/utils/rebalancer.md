# OUSD Rebalancer

The rebalancer moves USDC between OUSD strategies to maximise yield.
An off-chain operator (OpenZeppelin Defender) calls `buildRebalancePlan` periodically,
then submits the resulting strategy/amount arrays to the on-chain `RebalancerModule`.

## Running

```bash
cd contracts
npx hardhat planRebalance
```

This prints:
- Current vs recommended allocations per strategy
- Recommended deposit/withdraw actions with reasons
- Ethereum Morpho market details (utilization, APY)

## Simulation Mode

Simulate hypothetical balance changes to see how the rebalancer would respond:

```bash
# What if the vault had $500K more idle USDC?
npx hardhat planRebalance --sim-vault 500000

# What if Base Morpho had $200K more?
npx hardhat planRebalance --sim-base 200000

# Combine: vault +$500K, Ethereum Morpho -$100K
npx hardhat planRebalance --sim-vault 500000 --sim-eth -100000
```

### Available flags

| Flag          | Description                                           |
| ------------- | ----------------------------------------------------- |
| `--sim-vault` | Additional USDC in vault (whole dollars, can be negative) |
| `--sim-eth`   | Additional USDC in Ethereum Morpho strategy           |
| `--sim-base`  | Additional USDC in Base Morpho strategy               |
| `--sim-hyper` | Additional USDC in HyperEVM Morpho strategy           |

When simulation is active, a header is printed showing the adjustments applied.

## Reading the Output

### Table indicators

- `*` = default strategy (receives surplus vault funds as fallback)
- `#` = cross-chain transfer pending (deposits blocked until current transfer completes)

### Key columns

- **Current** - actual on-chain balance and allocation percentage
- **Avail.** - withdrawable liquidity (limited by market utilization)
- **Target (rec.)** - recommended balance after rebalancing
- **Delta** - amount to deposit (+) or withdraw (-)
- **1h APY** - time-windowed average APY used for allocation decisions
- **Spot APY** - current instantaneous APY
- **Exp. APY** - expected APY after the recommended action
- **Impact** - APY degradation caused by the action

---

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

**Withdrawal trimming**
After deposits are allocated, unnecessary withdrawals are cancelled. A withdrawal
is excess when vault surplus already covers the deposits it was meant to fund.
Excess withdrawals are cancelled smallest-first (fewer bridge transactions).

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
| `metaMorphoVaultAddress` | The inner MetaMorpho V1.1 vault. All OUSD Morpho deployments are VaultV2 wrappers; this is the underlying vault that actually holds Morpho Blue positions and has `supplyQueueLength()`. Used for on-chain APY reads and Morpho GraphQL API lookups. Derived via: `VaultV2(outerVaultAddr).adapters(0)` -> adapter; `adapter.morphoVaultV1()`. |
| `morphoChainId` | Chain where the Morpho vault lives (1 = Ethereum, 8453 = Base, 999 = HyperEVM) |
| `isCrossChain` | If it's a CrossChain strategy using CCTP |
| `isDefault` | Fallback strategy — exactly one per config |

---

## Constraints (`ousdConstraints`)

| Field | Value | Meaning |
|-------|-------|---------|
| `minMoveAmount` | $5K USDC | Minimum size for any rebalancing move |
| `crossChainMinAmount` | $25K USDC | Minimum for a cross-chain transfer (bridge overhead) |
| `minVaultBalance` | $0 USDC | Idle reserve always kept in the vault |
| `minApySpread` | 0.5% | Minimum APY improvement required to trigger a withdrawal |
| `maxApyThreshold` | 50% | APY above this is treated as suspicious — strategy is frozen in place |
| `maxApyImpactBps` | 50 bps | Skip a deposit if it would reduce the vault's on-chain APY by more than this |
| `maxWithdrawalApyImpactBps` | 50 bps | Max APY increase on source per withdrawal |
| `maxSpotBelowAvgBps` | 200 bps | Block deposits when spot APY diverges below avg |

## Files

- `utils/rebalancer.js` - core logic (allocation, filtering, formatting)
- `utils/rebalancer-config.js` - strategy configs and constraints
- `utils/morpho-apy.js` - Morpho APY fetching
- `tasks/rebalancer.js` - Hardhat task entry point
- `scripts/defender-actions/ousdRebalancer.js` - OpenZeppelin Defender automation
- `test/rebalancer/rebalancer.js` - unit tests
