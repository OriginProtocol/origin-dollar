const { ethers, BigNumber } = require("ethers");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("./addresses");

const {
  ousdMorphoStrategiesConfig,
  ousdConstraints,
  OETH_USDC_MARKET_ID,
  WSTETH_USDC_MARKET_ID,
  ethMorphoConstraints,
  getRpcUrl,
  getProvider,
} = require("./rebalancer-config");
const { fetchMorphoApys } = require("./morpho-apy");
const {
  findMaxWithdrawalRpc,
  computeDepositImpactRpc,
  computeWithdrawalImpactRpc,
} = require("origin-morpho-utils");

const log = require("./logger")("utils:rebalancer");

const USDC_DECIMALS = 6;

// USDC token address per chain (used by fetchMaxWithdrawals for cross-chain liquidity reads)
const USDC_BY_CHAIN = {
  1: addresses.mainnet.USDC,
  8453: addresses.base.USDC,
  999: addresses.hyperevm.USDC,
};

// Action constants shared with automation tasks and tests
const ACTION_DEPOSIT = "deposit";
const ACTION_WITHDRAW = "withdraw";
const ACTION_NONE = "none";

// Human-readable ABIs for contracts we interact with
const vaultAbi = [
  "function withdrawalQueueMetadata() external view returns (tuple(uint128 queued, uint128 claimable, uint128 claimed, uint128 nextWithdrawalIndex))",
];

const strategyAbi = [
  "function checkBalance(address _asset) external view returns (uint256)",
  // This exists only on CrossChain strategies
  "function isTransferPending() external view returns (bool)",
];

const erc20Abi = [
  "function balanceOf(address account) external view returns (uint256)",
];

// ABIs for withdrawable-liquidity reads
const maxWithdrawAbi = [
  "function maxWithdraw() external view returns (uint256)",
];
const platformAddressAbi = [
  "function platformAddress() external view returns (address)",
];
const erc4626MaxWithdrawAbi = [
  "function maxWithdraw(address owner) external view returns (uint256)",
];
const liquidityAdapterAbi = [
  "function liquidityAdapter() external view returns (address)",
];

/**
 * Constraint callback for Ethereum Morpho vault withdrawals.
 * Passed to findMaxWithdrawalRpc to enforce market-level health checks.
 *
 * @param {object} state - FindMaxConstraintState from origin-morpho-utils
 * @returns {boolean} true if the withdrawal is acceptable
 */
function ethMorphoWithdrawalConstraint(state) {
  const oethMarket = state.markets.find(
    (m) => m.marketId === OETH_USDC_MARKET_ID
  );
  const wstethMarket = state.markets.find(
    (m) => m.marketId === WSTETH_USDC_MARKET_ID
  );

  if (
    oethMarket &&
    oethMarket.simulated.utilization > ethMorphoConstraints.maxOethUtilization
  ) {
    return false;
  }

  if (oethMarket && wstethMarket) {
    const spread =
      oethMarket.simulated.supplyApy - wstethMarket.simulated.supplyApy;
    if (spread < ethMorphoConstraints.minOethWstethSpread) {
      return false;
    }
  }

  return true;
}

/**
 * Compute available vault balance and remaining shortfall from withdrawal queue state.
 *
 * The vault's USDC balance includes funds that are claimable but not yet claimed
 * (queued withdrawals waiting for users to pick up). These must be reserved.
 *
 * @param {object}    queueMeta    - { queued, claimable, claimed }
 * @param {BigNumber} vaultBalance - raw USDC.balanceOf(vault)
 * @returns {{ availableVaultBalance: BigNumber, shortfall: BigNumber }}
 */
function computeAvailableBalance(queueMeta, vaultBalance) {
  // Total owed to the queue = requested minus what users already took
  let shortfall = queueMeta.queued.sub(queueMeta.claimed);
  let availableVaultBalance = vaultBalance;
  if (shortfall.gt(0) && vaultBalance.gt(0)) {
    if (shortfall.lt(vaultBalance)) {
      availableVaultBalance = vaultBalance.sub(shortfall);
      shortfall = BigNumber.from(0);
    } else {
      availableVaultBalance = BigNumber.from(0);
      shortfall = shortfall.sub(vaultBalance);
    }
  }
  return { availableVaultBalance, shortfall };
}

/**
 * Read on-chain state: Morpho strategy balances, vault idle USDC, withdrawal queue.
 * @returns {object} { strategies, vaultBalance, shortfall }
 */
async function readOnChainState() {
  const provider = getProvider(1);
  const vault = new ethers.Contract(
    addresses.mainnet.VaultProxy,
    vaultAbi,
    provider
  );
  const usdc = new ethers.Contract(addresses.mainnet.USDC, erc20Abi, provider);

  // Read the withdrawal queue metadata and the vault's USDC balance
  const [queueMeta, vaultBalance] = await Promise.all([
    vault.withdrawalQueueMetadata(),
    usdc.balanceOf(addresses.mainnet.VaultProxy),
  ]);

  // Reserve vault balance for pending withdrawals (includes claimable-but-unclaimed)
  const { availableVaultBalance, shortfall } = computeAvailableBalance(
    queueMeta,
    vaultBalance
  );

  // Read the balances of the configured Morpho strategies
  const strategies = await Promise.all(
    ousdMorphoStrategiesConfig.map(async (cfg) => {
      const strategy = new ethers.Contract(cfg.address, strategyAbi, provider);

      const [balance, isTransferPending] = await Promise.all([
        strategy.checkBalance(addresses.mainnet.USDC),
        cfg.isCrossChain ? strategy.isTransferPending() : false,
      ]);

      return {
        name: cfg.name,
        address: cfg.address,
        metaMorphoVaultAddress: cfg.metaMorphoVaultAddress,
        morphoChainId: cfg.morphoChainId,
        isCrossChain: cfg.isCrossChain,
        isDefault: cfg.isDefault || false,
        withdrawalConstraint:
          !cfg.isCrossChain && cfg.morphoChainId === 1
            ? ethMorphoWithdrawalConstraint
            : undefined,
        balance,
        isTransferPending,
      };
    })
  );

  return {
    strategies,
    vaultBalance: availableVaultBalance,
    shortfall,
  };
}

/**
 * Compute total capital minus reserved amounts (shortfall + minVaultBalance).
 */
function _computeDeployableCapital(
  strategies,
  vaultBalance,
  shortfall,
  constraints
) {
  const totalRebalancable = strategies.reduce(
    (sum, s) => sum.add(s.balance),
    vaultBalance
  );
  const reserved = shortfall.add(BigNumber.from(constraints.minVaultBalance));
  return totalRebalancable.gt(reserved)
    ? totalRebalancable.sub(reserved)
    : BigNumber.from(0);
}

/**
 * Greedy fill: sort strategies by APY descending, fill each up to its per-strategy
 * maxAllocationBps.
 * Returns a plain object { [address]: BigNumber } of target balances.
 */
function _greedyFillByApy(strategies, deployableCapital, strategyApyOf) {
  const sorted = [...strategies].sort(
    (a, b) => strategyApyOf(b) - strategyApyOf(a)
  );

  const targets = {};
  for (const s of strategies) targets[s.address] = BigNumber.from(0);

  let remaining = deployableCapital;
  for (const s of sorted) {
    const maxBps = s.maxAllocationBps != null ? s.maxAllocationBps : 10000;
    const maxAllocationAmt = deployableCapital.mul(maxBps).div(10000);

    const alloc = remaining.lt(maxAllocationAmt) ? remaining : maxAllocationAmt;
    targets[s.address] = alloc;
    remaining = remaining.sub(alloc);
    if (remaining.isZero()) break;
  }

  // Dust from rounding goes to the default strategy
  if (remaining.gt(0)) {
    const defaultStrategy = strategies.find((s) => s.isDefault);
    if (defaultStrategy) {
      targets[defaultStrategy.address] =
        targets[defaultStrategy.address].add(remaining);
    }
  }

  return targets;
}

/**
 * Ensure every strategy meets its minAllocationBps.
 * Claws back deficit from highest-allocated strategies that are above their own minimum.
 */
function _enforceMinimums(
  targets,
  strategies,
  deployableCapital,
  withdrawalCapacities = {}
) {
  // Effective minimum per strategy: max of policy min and withdrawal capacity floor
  const effectiveMin = (s) => {
    let min = BigNumber.from(0);
    if (s.minAllocationBps) {
      const policyMin = deployableCapital.mul(s.minAllocationBps).div(10000);
      if (policyMin.gt(min)) min = policyMin;
    }
    const wCap = withdrawalCapacities[s.metaMorphoVaultAddress];
    if (wCap) {
      const capacityFloor = s.balance.sub(wCap.maxWithdraw);
      if (capacityFloor.gt(min)) min = capacityFloor;
    }
    return min;
  };

  const belowMin = strategies.filter((s) =>
    targets[s.address].lt(effectiveMin(s))
  );

  for (const under of belowMin) {
    const minAmt = effectiveMin(under);
    const deficit = minAmt.sub(targets[under.address]);
    targets[under.address] = minAmt;

    // Claw back from highest-allocated strategies (respecting their effective minimums)
    const sorted = [...strategies]
      .filter((s) => s.address !== under.address)
      .sort((a, b) => (targets[b.address].gt(targets[a.address]) ? 1 : -1));

    let toReduce = deficit;
    for (const s of sorted) {
      const sMin = effectiveMin(s);
      const available = targets[s.address].sub(sMin);
      if (available.lte(0)) continue;
      const take = available.lt(toReduce) ? available : toReduce;
      targets[s.address] = targets[s.address].sub(take);
      toReduce = toReduce.sub(take);
      if (toReduce.isZero()) break;
    }
  }

  return targets;
}

/**
 * Compute APY for a strategy at a given delta from its current on-chain balance.
 * Positive delta = deposit, negative = withdrawal, zero = current APY.
 *
 * @param {object} strategy - strategy config with morphoChainId, metaMorphoVaultAddress
 * @param {BigNumber} delta - cumulative change from current balance
 * @param {object} currentApys - { metaMorphoVaultAddress: apy }
 * @returns {Promise<number>} post-action APY
 */
async function _computeApyAtDelta(strategy, delta, currentApys) {
  if (delta.isZero()) {
    return currentApys[strategy.metaMorphoVaultAddress] || 0;
  }
  const rpcUrl = getRpcUrl(strategy.morphoChainId);
  if (!rpcUrl) {
    return currentApys[strategy.metaMorphoVaultAddress] || 0;
  }
  try {
    const result = delta.gt(0)
      ? await computeDepositImpactRpc(
          rpcUrl,
          strategy.morphoChainId,
          strategy.metaMorphoVaultAddress,
          delta.toBigInt()
        )
      : await computeWithdrawalImpactRpc(
          rpcUrl,
          strategy.morphoChainId,
          strategy.metaMorphoVaultAddress,
          delta.abs().toBigInt()
        );
    return result.newApy;
  } catch (err) {
    log(`APY computation failed for ${strategy.name}: ${err.message}`);
    return currentApys[strategy.metaMorphoVaultAddress] || 0;
  }
}

/**
 * Step-wise marginal APY allocation: allocate capital in chunks, always to
 * the strategy with the highest post-deposit APY. Naturally equalizes marginal
 * APYs across strategies — the theoretical optimum.
 *
 * @param {Array}     strategies        - strategy config objects with balance
 * @param {BigNumber} deployableCapital - total capital to distribute
 * @param {object}    constraints       - merged constraints (includes allocationChunkSize)
 * @param {object}    currentApys       - { metaMorphoVaultAddress: apy }
 * @param {object}    [withdrawalCapacities] - from discoverWithdrawalCapacities()
 * @param {Function}  [computeApy]      - APY function override (for testing)
 * @returns {Promise<object>} { [strategyAddress]: BigNumber } target balances
 */
async function _stepWiseFillByMarginalApy(
  strategies,
  deployableCapital,
  constraints,
  currentApys,
  withdrawalCapacities = {},
  computeApy = _computeApyAtDelta
) {
  const chunkSize = BigNumber.from(
    constraints.allocationChunkSize || 50000000000
  );

  const targets = {};
  const maxAlloc = {};
  const apyCache = {};
  const full = new Set();

  // Step 1: Compute floors (minAllocationBps + withdrawal capacity floor)
  for (const s of strategies) {
    let floor = BigNumber.from(0);
    if (s.minAllocationBps) {
      const policyMin = deployableCapital.mul(s.minAllocationBps).div(10000);
      if (policyMin.gt(floor)) floor = policyMin;
    }
    const wCap = withdrawalCapacities[s.metaMorphoVaultAddress];
    if (wCap && wCap.maxWithdraw != null) {
      const capacityFloor = s.balance.sub(wCap.maxWithdraw);
      if (capacityFloor.gt(floor)) floor = capacityFloor;
    }

    targets[s.address] = floor;

    const maxBps = s.maxAllocationBps != null ? s.maxAllocationBps : 10000;
    maxAlloc[s.address] = deployableCapital.mul(maxBps).div(10000);

    if (targets[s.address].gte(maxAlloc[s.address])) {
      targets[s.address] = maxAlloc[s.address];
      full.add(s.address);
    }
  }

  let remaining = deployableCapital;
  for (const s of strategies) {
    remaining = remaining.sub(targets[s.address]);
  }

  // Step 2: Seed APY cache (parallel RPC calls)
  await Promise.all(
    strategies.map(async (s) => {
      if (full.has(s.address)) return;
      const delta = targets[s.address].sub(s.balance);
      apyCache[s.address] = await computeApy(s, delta, currentApys);
    })
  );

  // Step 3: Greedy step-wise fill
  while (remaining.gt(0)) {
    // Find strategy with highest cached APY that's not full
    let bestAddr = null;
    let bestApy = -Infinity;
    for (const s of strategies) {
      if (full.has(s.address)) continue;
      const apy = apyCache[s.address];
      if (apy != null && apy > bestApy) {
        bestApy = apy;
        bestAddr = s.address;
      }
    }

    if (!bestAddr) break;

    const best = strategies.find((s) => s.address === bestAddr);
    const headroom = maxAlloc[bestAddr].sub(targets[bestAddr]);
    const chunk = remaining.lt(chunkSize)
      ? remaining
      : chunkSize.lt(headroom)
      ? chunkSize
      : headroom;

    if (chunk.isZero()) {
      full.add(bestAddr);
      continue;
    }

    targets[bestAddr] = targets[bestAddr].add(chunk);
    remaining = remaining.sub(chunk);

    if (targets[bestAddr].gte(maxAlloc[bestAddr])) {
      full.add(bestAddr);
    }

    // Recompute APY for winner (others unchanged — different chains)
    if (remaining.gt(0)) {
      const newDelta = targets[bestAddr].sub(best.balance);
      apyCache[bestAddr] = await computeApy(best, newDelta, currentApys);
    }
  }

  return targets;
}

/**
 * Impact-aware allocation: step-wise marginal APY optimization via RPC.
 * Same return format as computeIdealAllocation.
 *
 * @param {object} params - same shape as computeIdealAllocation params
 * @param {Function} [params.computeApy] - APY function override (for testing)
 * @returns {Promise<Array>} allocation rows
 */
async function computeImpactAwareAllocation({
  strategies,
  apys,
  spotApys = {},
  vaultBalance,
  shortfall,
  constraints: overrides = {},
  withdrawalCapacities = {},
  computeApy,
}) {
  const constraints = { ...ousdConstraints, ...overrides };
  const strategyApyOf = (s) => apys[s.metaMorphoVaultAddress] || 0;
  const strategySpotApyOf = (s) => spotApys[s.metaMorphoVaultAddress] || 0;
  const deployableCapital = _computeDeployableCapital(
    strategies,
    vaultBalance,
    shortfall,
    constraints
  );

  if (deployableCapital.isZero()) {
    return strategies.map((s) =>
      _buildAllocationRow(
        s,
        BigNumber.from(0),
        strategyApyOf(s),
        strategySpotApyOf(s)
      )
    );
  }

  const args = [
    strategies,
    deployableCapital,
    constraints,
    apys,
    withdrawalCapacities,
  ];
  if (computeApy) args.push(computeApy);
  const targets = await _stepWiseFillByMarginalApy(...args);

  const adjusted = _enforceMinimums(
    targets,
    strategies,
    deployableCapital,
    withdrawalCapacities
  );
  return strategies.map((s) =>
    _buildAllocationRow(
      s,
      adjusted[s.address],
      strategyApyOf(s),
      strategySpotApyOf(s)
    )
  );
}

/**
 * Build an allocation row for a strategy given its computed target balance.
 */
function _buildAllocationRow(s, targetBalance, apy, spotApy = 0) {
  const delta = targetBalance.sub(s.balance);
  return {
    name: s.name,
    address: s.address,
    isCrossChain: s.isCrossChain,
    isTransferPending: s.isTransferPending,
    isDefault: s.isDefault,
    metaMorphoVaultAddress: s.metaMorphoVaultAddress,
    morphoChainId: s.morphoChainId,
    balance: s.balance,
    // Populated later by fetchMaxWithdrawals; null means unknown (no constraint applied)
    withdrawableLiquidity: null,
    apy,
    spotApy,
    targetBalance,
    delta,
    action: delta.gt(0)
      ? ACTION_DEPOSIT
      : delta.lt(0)
      ? ACTION_WITHDRAW
      : ACTION_NONE,
  };
}

/**
 * Pure computation: given balances and APYs, compute target allocations.
 *
 * Total capital = sum(rebalancableBalances) + vaultBalance - shortfall - minVaultBalance
 * Shortfall + minVaultBalance are pre-reserved for the vault, excluded from the allocation pie.
 *
 * Allocation: sort strategies by APY descending, fill each up to per-strategy maxAllocationBps.
 * Each strategy is guaranteed at least its minAllocationBps.
 *
 * @param {object} params
 * @param {Array}  params.strategies
 * @param {object} params.apys - metaMorphoVaultAddress -> apy (float, on-chain)
 * @param {object} [params.spotApys] - metaMorphoVaultAddress -> spot apy (float, instantaneous)
 * @param {BigNumber} params.vaultBalance
 * @param {BigNumber} params.shortfall
 * @param {object} [params.constraints]
 * @returns {Array} allocation results
 */
function computeIdealAllocation({
  strategies,
  apys,
  spotApys = {},
  vaultBalance,
  shortfall,
  constraints: overrides = {},
  withdrawalCapacities = {},
}) {
  const constraints = { ...ousdConstraints, ...overrides };
  const strategyApyOf = (s) => apys[s.metaMorphoVaultAddress] || 0;
  const strategySpotApyOf = (s) => spotApys[s.metaMorphoVaultAddress] || 0;
  const deployableCapital = _computeDeployableCapital(
    strategies,
    vaultBalance,
    shortfall,
    constraints
  );

  if (deployableCapital.isZero()) {
    return strategies.map((s) =>
      _buildAllocationRow(
        s,
        BigNumber.from(0),
        strategyApyOf(s),
        strategySpotApyOf(s)
      )
    );
  }

  const targets = _greedyFillByApy(
    strategies,
    deployableCapital,
    strategyApyOf
  );
  const adjusted = _enforceMinimums(
    targets,
    strategies,
    deployableCapital,
    withdrawalCapacities
  );
  return strategies.map((s) =>
    _buildAllocationRow(
      s,
      adjusted[s.address],
      strategyApyOf(s),
      strategySpotApyOf(s)
    )
  );
}

/**
 * Discover the maximum withdrawal amount per strategy that keeps APY impact
 * within the threshold and satisfies strategy-specific constraints.
 *
 * @param {Array}  strategies  - strategy config objects with balance
 * @param {object} constraints
 * @returns {object} { [metaMorphoVaultAddress]: { maxWithdraw, postWithdrawalApy, impactBps } }
 */
async function discoverWithdrawalCapacities(strategies, constraints) {
  const capacities = {};
  await Promise.all(
    strategies.map(async (s) => {
      if (!s.metaMorphoVaultAddress || !s.morphoChainId) return;
      const rpcUrl = getRpcUrl(s.morphoChainId);
      if (!rpcUrl) {
        return; // No constraint applied — withdrawal allowed up to liquidity
      }
      try {
        if (s.balance.lt(constraints.minMoveAmount)) return;
        const result = await findMaxWithdrawalRpc(
          rpcUrl,
          s.morphoChainId,
          s.metaMorphoVaultAddress,
          s.balance.toBigInt(),
          constraints.maxWithdrawalApyImpactBps,
          {
            precision: BigInt(constraints.withdrawalStepSize),
            includeMarkets: !!s.withdrawalConstraint,
            constraint: s.withdrawalConstraint,
          }
        );
        const maxWithdraw = BigNumber.from(result.amount.toString());
        capacities[s.metaMorphoVaultAddress] = {
          maxWithdraw,
          impactBps: result.impact.impactBps,
          postWithdrawalApy: result.impact.newApy,
          markets: result.impact.markets,
        };
        log(
          `Withdrawal capacity for ${s.name}: ${fmtUsd(maxWithdraw)} ` +
            `(impact ${result.impact.impactBps}bps, post-withdrawal APY ${(
              result.impact.newApy * 100
            ).toFixed(2)}%)`
        );
      } catch (err) {
        log(
          `Withdrawal capacity discovery failed for ${s.name}: ${err.message}`
        );
        // Fail-open: if we can't determine capacity, allow withdrawal up to liquidity.
        // Withdrawal constraints are protective but not critical — better to rebalance
        // than to freeze funds due to an RPC error.
      }
    })
  );
  return capacities;
}

/**
 * Strip withdrawal-only metadata from an action that is no longer a withdrawal.
 */
function _clearWithdrawalFields(w) {
  delete w.expectedApy;
  delete w.impactBps;
  delete w.markets;
}

/**
 * Weighted-average portfolio APY across strategies + idle vault (at 0%).
 *
 * Denominator is `totalCapital` (vault + strategies), passed in so before/after
 * share the same base — the balance-conservation identity
 * `vaultTarget + Σ targetBalance = vaultBalance + Σ balance` means this is safe.
 *
 * @param {Array}     actions      - allocation rows (with balance, targetBalance, apy, expectedApy)
 * @param {BigNumber} totalCapital - vault + sum of strategy balances
 * @param {object}    [opts]
 * @param {boolean}   [opts.useTarget=false] - if true, weight by targetBalance and use expectedApy ?? apy
 * @returns {number} weighted APY as a decimal (e.g. 0.0514 for 5.14%)
 */
function computePortfolioApy(
  actions,
  totalCapital,
  { useTarget = false } = {}
) {
  const total = parseFloat(formatUnits(totalCapital, USDC_DECIMALS));
  if (!total) return 0;
  let weighted = 0;
  for (const a of actions) {
    const balBn = useTarget ? a.targetBalance : a.balance;
    const bal = parseFloat(formatUnits(balBn, USDC_DECIMALS));
    const apy = useTarget
      ? a.expectedApy != null
        ? a.expectedApy
        : a.apy
      : a.apy;
    weighted += bal * (apy || 0);
  }
  return weighted / total;
}

/**
 * Portfolio-level minApySpread gate. If the rebalance lifts weighted portfolio APY
 * by less than `constraints.minApySpread`, cancel every yield-motivated action.
 * Actions flagged `isShortfall` (from `_coverShortfall`) or `isVaultSurplus`
 * (from `_deployRemainingSurplus`) are preserved regardless — they are
 * operational, not yield-motivated.
 *
 * Mutates actions in place. Returns the before/after/delta triple for display.
 */
function _applyPortfolioSpreadGate(
  actions,
  totalCapital,
  constraints,
  warnings
) {
  const before = computePortfolioApy(actions, totalCapital, {
    useTarget: false,
  });
  const afterInitial = computePortfolioApy(actions, totalCapital, {
    useTarget: true,
  });
  const deltaBps = Math.round((afterInitial - before) * 10000);
  const minSpreadBps = Math.round((constraints.minApySpread || 0) * 10000);

  let gated = false;
  if (constraints.minApySpread != null && deltaBps < minSpreadBps) {
    const droppedNames = [];
    for (const a of actions) {
      if (a.action === ACTION_NONE) continue;
      if (a.isShortfall || a.isVaultSurplus) continue;
      droppedNames.push(a.name);
      a.action = ACTION_NONE;
      a.delta = BigNumber.from(0);
      a.targetBalance = a.balance;
      a.reason = `portfolio APY lift ${deltaBps}bps < minApySpread ${minSpreadBps}bps — dropped`;
      _clearWithdrawalFields(a);
    }
    if (droppedNames.length > 0) {
      gated = true;
      warnings.push(
        `Portfolio APY lift ${deltaBps}bps < minApySpread ${minSpreadBps}bps — ` +
          `yield-motivated actions dropped: ${droppedNames.join(", ")}`
      );
    }
  }

  const after = gated
    ? computePortfolioApy(actions, totalCapital, { useTarget: true })
    : afterInitial;

  return {
    before,
    after,
    deltaBps: Math.round((after - before) * 10000),
    gated,
  };
}

/**
 * Vault surplus above reserves (shortfall + minVaultBalance).
 */
function _computeVaultSurplus(vaultBalance, shortfall, constraints) {
  const raw = vaultBalance
    .sub(shortfall)
    .sub(BigNumber.from(constraints.minVaultBalance));
  return raw.gt(0) ? raw : BigNumber.from(0);
}

/**
 * Filter withdrawals by feasibility: min move amount, cross-chain min, liquidity,
 * and withdrawal capacity (APY impact + strategy-specific constraints).
 * Infeasible withdrawals are set to ACTION_NONE with a reason.
 *
 * Note: APY spread check has moved to _resolveDeposit (post-impact spread).
 * Per-strategy minAllocationBps prevents over-withdrawing from important strategies.
 */
function _filterWithdrawals(result, constraints, withdrawalCapacities = {}) {
  const withdrawals = result.filter((a) => a.action === ACTION_WITHDRAW);

  for (const w of withdrawals) {
    let amt = w.delta.abs();

    // Cap to available liquidity first so subsequent size checks use the capped amount
    if (w.withdrawableLiquidity != null) {
      const liq = w.withdrawableLiquidity;
      if (liq.lt(constraints.minMoveAmount)) {
        w.action = ACTION_NONE;
        w.reason = `insufficient liquidity: ${fmtUsd(liq)} available`;
        continue;
      }
      if (amt.gt(liq)) {
        amt = liq;
        w.delta = amt.mul(-1);
        w.targetBalance = w.balance.sub(amt);
        w.reason = `capped to available liquidity: ${fmtUsd(liq)}`;
      }
    }

    // Attach current market data for display (actual impact computed later)
    const cap = withdrawalCapacities[w.metaMorphoVaultAddress];
    if (cap && cap.markets) {
      w.markets = cap.markets;
    }

    if (amt.lt(constraints.minMoveAmount)) {
      w.action = ACTION_NONE;
      w.reason = "below min move";
    } else if (w.isCrossChain && amt.lt(constraints.crossChainMinAmount)) {
      w.action = ACTION_NONE;
      w.reason = "below cross-chain min";
    }
  }

  return result;
}

/**
 * Resolve a single deposit: early-exit checks, budget cap, min-check.
 * Returns result without mutating deposit.
 *
 * @returns {{ rejected: boolean, amt?, reason?, surplusUsed?, warn? }}
 */
function _resolveDeposit(deposit, budget, surplusBudget, constraints) {
  // Early exits
  if (deposit.isCrossChain && deposit.isTransferPending) {
    return { rejected: true, reason: "transfer pending" };
  }
  if (constraints.maxSpotBelowAvgBps && deposit.spotApy < deposit.apy) {
    const divergenceBps = Math.round((deposit.apy - deposit.spotApy) * 10000);
    if (divergenceBps > constraints.maxSpotBelowAvgBps) {
      return {
        rejected: true,
        warn: true,
        reason:
          `spot APY ${(deposit.spotApy * 100).toFixed(
            2
          )}% is ${divergenceBps}bps ` +
          `below ${constraints.apyAverageWindow || "1h"} avg ${(
            deposit.apy * 100
          ).toFixed(2)}% — deposit blocked`,
      };
    }
  }
  if (budget.isZero()) {
    return { rejected: true, reason: "insufficient vault funds" };
  }

  // Cap to available budget
  let amt = deposit.delta.gt(budget) ? budget : deposit.delta;
  let reason = null;

  // Single min-amount check
  if (amt.lt(constraints.minMoveAmount)) {
    return { rejected: true, reason: "below min move" };
  }
  if (deposit.isCrossChain && amt.lt(constraints.crossChainMinAmount)) {
    return { rejected: true, reason: "below cross-chain min" };
  }

  // Approved — determine reason
  if (amt.lt(deposit.delta)) {
    reason = "trimmed to available vault funds";
  }

  const surplusUsed = amt.gt(surplusBudget) ? surplusBudget : amt;
  return { rejected: false, amt, reason, surplusUsed };
}

/**
 * Deploy remaining vault surplus to the default strategy.
 *
 * Sets `isVaultSurplus = true` on the resulting action so the portfolio-APY gate
 * preserves it (surplus deployment is not yield-motivated).
 */
function _deployRemainingSurplus(result, surplus) {
  const defaultStrategy = result.find(
    (a) => a.isDefault && a.reason !== "APY exceeds threshold"
  );
  if (!defaultStrategy) return;

  defaultStrategy.isVaultSurplus = true;

  if (defaultStrategy.action === ACTION_DEPOSIT) {
    defaultStrategy.delta = defaultStrategy.delta.add(surplus);
    defaultStrategy.targetBalance = defaultStrategy.targetBalance.add(surplus);
    defaultStrategy.reason = defaultStrategy.reason
      ? `${defaultStrategy.reason}; +vault surplus fallback`
      : "vault surplus fallback";
  } else if (defaultStrategy.action === ACTION_WITHDRAW) {
    // Net surplus against the pending withdrawal
    const withdrawAmt = defaultStrategy.delta.abs();
    if (surplus.gte(withdrawAmt)) {
      // Surplus exceeds withdrawal — flip to deposit with net amount
      const net = surplus.sub(withdrawAmt);
      if (net.isZero()) {
        defaultStrategy.action = ACTION_NONE;
        defaultStrategy.delta = BigNumber.from(0);
        defaultStrategy.targetBalance = defaultStrategy.balance;
        defaultStrategy.reason = "vault surplus offsets withdrawal";
      } else {
        defaultStrategy.action = ACTION_DEPOSIT;
        defaultStrategy.delta = net;
        defaultStrategy.targetBalance = defaultStrategy.balance.add(net);
        defaultStrategy.reason = "vault surplus (net of cancelled withdrawal)";
      }
    } else {
      // Reduce the withdrawal by surplus amount
      const reduced = withdrawAmt.sub(surplus);
      defaultStrategy.delta = reduced.mul(-1);
      defaultStrategy.targetBalance = defaultStrategy.balance.sub(reduced);
      defaultStrategy.reason = defaultStrategy.reason
        ? `${defaultStrategy.reason}; reduced by vault surplus`
        : "reduced by vault surplus";
    }
    _clearWithdrawalFields(defaultStrategy);
  } else {
    defaultStrategy.delta = surplus;
    defaultStrategy.targetBalance = defaultStrategy.balance.add(surplus);
    defaultStrategy.action = ACTION_DEPOSIT;
    defaultStrategy.reason = "vault surplus fallback";
  }
}

/**
 * Allocate deposit budget across strategies in APY-descending order.
 * Budget = approved withdrawal total + vault surplus above reserves.
 * After allocation, any remaining surplus is deployed to the default strategy.
 */
async function _allocateDeposits(
  result,
  vaultBalance,
  shortfall,
  constraints,
  warnings
) {
  const approvedWithdrawals = result.filter(
    (a) => a.action === ACTION_WITHDRAW
  );
  const withdrawTotal = approvedWithdrawals.reduce(
    (sum, a) => sum.add(a.delta.abs()),
    BigNumber.from(0)
  );
  const vaultSurplus = _computeVaultSurplus(
    vaultBalance,
    shortfall,
    constraints
  );
  let budget = withdrawTotal.add(vaultSurplus);
  let surplusBudget = vaultSurplus;

  const deposits = result
    .filter((a) => a.action === ACTION_DEPOSIT)
    .sort((a, b) => b.apy - a.apy);

  for (const deposit of deposits) {
    const res = _resolveDeposit(deposit, budget, surplusBudget, constraints);

    if (res.rejected) {
      deposit.action = ACTION_NONE;
      deposit.reason = res.reason;
      if (res.warn) warnings.push(`${deposit.name}: ${res.reason}`);
      continue;
    }

    // Apply approved result
    if (res.amt.lt(deposit.delta)) {
      deposit.delta = res.amt;
      deposit.targetBalance = deposit.balance.add(res.amt);
    }
    if (res.reason) deposit.reason = res.reason;
    budget = budget.sub(res.amt);
    surplusBudget = surplusBudget.sub(res.surplusUsed);
  }

  // Deploy remaining surplus to default strategy
  if (surplusBudget.gte(BigNumber.from(constraints.minMoveAmount))) {
    _deployRemainingSurplus(result, surplusBudget);
  }

  return result;
}

/**
 * Compute how much the default strategy should withdraw for a shortfall.
 * Returns null if it can't cover.
 */
function _computeShortfallWithdrawAmount(
  defaultStrategy,
  shortfall,
  constraints
) {
  // Default was already overallocated — withdraw the larger of delta and shortfall
  if (defaultStrategy.delta.lt(0)) {
    const effectiveAmt = defaultStrategy.delta.abs().gt(shortfall)
      ? defaultStrategy.delta.abs()
      : shortfall;
    return defaultStrategy.balance.lt(effectiveAmt)
      ? defaultStrategy.balance
      : effectiveAmt;
  }
  // Small shortfall (below cross-chain threshold) — withdraw from default regardless
  if (shortfall.lt(constraints.crossChainMinAmount)) {
    return defaultStrategy.balance.lt(shortfall)
      ? defaultStrategy.balance
      : shortfall;
  }
  // Large shortfall — only withdraw if default can fully cover it
  if (defaultStrategy.balance.gte(shortfall)) {
    return shortfall;
  }
  return null;
}

/**
 * Mark approved withdrawals funding the vault deficit as `isShortfall = true`
 * so the portfolio spread gate preserves them. Walks withdrawals in priority
 * order — default (same-chain) first, then cross-chain sorted by lowest APY —
 * flagging each until the deficit is covered.
 *
 * Whole-withdrawal flagging (no splitting): if a withdrawal only partially
 * covers the remaining deficit, the full withdrawal is flagged. Any excess
 * lands in the vault and is redeployed on the next rebalance as vault surplus.
 * Splitting would require re-checking minMoveAmount / crossChainMinAmount /
 * liquidity invariants mid-plan; the worst case here is one extra rebalance
 * cycle to redeploy the leftover.
 */
function _markShortfallWithdrawals(
  result,
  vaultBalance,
  shortfall,
  constraints
) {
  const vaultTarget = shortfall.add(
    BigNumber.from(constraints.minVaultBalance)
  );
  let deficit = vaultTarget.gt(vaultBalance)
    ? vaultTarget.sub(vaultBalance)
    : BigNumber.from(0);
  if (deficit.lte(0)) return result;

  const withdrawals = result.filter((a) => a.action === ACTION_WITHDRAW);
  const defaults = withdrawals.filter((w) => w.isDefault);
  const crossChain = withdrawals
    .filter((w) => !w.isDefault)
    .sort((a, b) => a.apy - b.apy);
  const ordered = [...defaults, ...crossChain];

  for (const w of ordered) {
    if (deficit.lte(0)) break;
    w.isShortfall = true;
    deficit = deficit.sub(w.delta.abs());
  }

  return result;
}

/**
 * Cover a withdrawal shortfall when no rebalancing withdrawals were approved.
 * Tries the default (same-chain) strategy first, then lowest-APY cross-chain.
 */
function _coverShortfall(result, shortfall, constraints) {
  // Try default (same-chain) strategy first — skip if excluded (frozen)
  const defaultStrategy = result.find(
    (a) => a.isDefault && a.reason !== "APY exceeds threshold"
  );
  if (defaultStrategy && defaultStrategy.balance.gt(0)) {
    const amt = _computeShortfallWithdrawAmount(
      defaultStrategy,
      shortfall,
      constraints
    );
    if (amt && amt.gt(0)) {
      defaultStrategy.delta = amt.mul(-1);
      defaultStrategy.targetBalance = defaultStrategy.balance.sub(amt);
      defaultStrategy.action = ACTION_WITHDRAW;
      defaultStrategy.reason = "shortfall fallback";
      defaultStrategy.isShortfall = true;
      return result;
    }
  }

  // Default couldn't cover — try lowest-APY cross-chain strategy (skip excluded)
  const crossChainCandidates = result
    .filter(
      (a) =>
        a.isCrossChain &&
        a.balance.gt(constraints.crossChainMinAmount) &&
        a.reason !== "APY exceeds threshold"
    )
    .sort((a, b) => a.apy - b.apy);

  if (crossChainCandidates.length > 0) {
    const s = crossChainCandidates[0];
    const amt = s.balance.lt(shortfall) ? s.balance : shortfall;
    s.delta = amt.mul(-1);
    s.targetBalance = s.balance.sub(amt);
    s.action = ACTION_WITHDRAW;
    s.reason = "shortfall fallback (cross-chain)";
    s.isShortfall = true;
  }

  return result;
}

/**
 * After deposit filtering, cancel or reduce withdrawals whose total exceeds
 * what is actually needed: approved deposits + vault deficit.
 *
 * vault deficit = max(0, shortfall + minVaultBalance − vaultBalance)
 *
 * Safety invariant: a withdrawal is only cancelled when its full amount falls
 * within the excess (amt ≤ excess). If trimming would put it below minMoveAmount
 * but amt > excess, the withdrawal is left unchanged and a small residual excess
 * (< minMoveAmount) is accepted rather than over-cancelling and leaving deposits
 * without budget.
 *
 * @param {Array}     result      - allocations array
 * @param {BigNumber} vaultBalance
 * @param {BigNumber} shortfall
 * @param {object}    constraints - merged constraints
 * @returns {Array}
 */
function _trimExcessWithdrawals(result, vaultBalance, shortfall, constraints) {
  const totalApprovedDeposits = result
    .filter((a) => a.action === ACTION_DEPOSIT)
    .reduce((sum, a) => sum.add(a.delta.abs()), BigNumber.from(0));

  const vaultTarget = shortfall.add(
    BigNumber.from(constraints.minVaultBalance)
  );
  const vaultDeficit = vaultTarget.gt(vaultBalance)
    ? vaultTarget.sub(vaultBalance)
    : BigNumber.from(0);

  const vaultSurplus = vaultBalance.gt(vaultTarget)
    ? vaultBalance.sub(vaultTarget)
    : BigNumber.from(0);

  // Vault surplus already funds deposits without needing withdrawals.
  // Subtract the surplus-funded portion so we only keep withdrawals that
  // are actually required.
  const surplusFunding = vaultSurplus.gt(totalApprovedDeposits)
    ? totalApprovedDeposits
    : vaultSurplus;
  const totalNeeded = totalApprovedDeposits
    .sub(surplusFunding)
    .add(vaultDeficit);

  const withdrawals = result.filter((a) => a.action === ACTION_WITHDRAW);
  const totalApprovedWithdrawals = withdrawals.reduce(
    (sum, a) => sum.add(a.delta.abs()),
    BigNumber.from(0)
  );

  let excess = totalApprovedWithdrawals.sub(totalNeeded);
  if (excess.lte(0)) return result;

  // Process smallest-first: cancelling a small withdrawal entirely (1 fewer bridge tx)
  // is cheaper than trimming a large one (which still requires the bridge). With two
  // approved withdrawals (e.g. Base $30K, HyperEVM $300K) and excess = $30K,
  // smallest-first cancels the $30K entirely → 1 bridge tx. Largest-first would trim
  // the $300K to $270K → 2 bridge txs.
  //
  // Safety: in the full-cancel branch (amt ≤ excess), no budget check is needed because
  // excess = totalWithdrawals − totalNeeded, so cancelling any single withdrawal whose
  // amount ≤ excess cannot underfund approved deposits. The partial-trim and cancel-below-
  // minMoveAmount branches do check budgetAfterCancel.
  const sorted = [...withdrawals].sort((a, b) =>
    a.delta.abs().lt(b.delta.abs()) ? -1 : 1
  );

  let runningTotal = totalApprovedWithdrawals;

  for (const w of sorted) {
    if (excess.lte(0)) break;
    const amt = w.delta.abs();

    if (amt.lte(excess)) {
      // Entire withdrawal is within excess — safe to cancel (deposits stay funded).
      excess = excess.sub(amt);
      runningTotal = runningTotal.sub(amt);
      w.action = ACTION_NONE;
      w.reason = "no approved deposits to fund";
      _clearWithdrawalFields(w);
    } else {
      // Only part of this withdrawal is excess.
      const newAmt = amt.sub(excess);
      if (newAmt.gte(BigNumber.from(constraints.minMoveAmount))) {
        // Safe to trim.
        w.delta = newAmt.mul(-1);
        w.targetBalance = w.balance.sub(newAmt);
        w.reason = "trimmed to match approved deposits";
        runningTotal = runningTotal.sub(excess);
        excess = BigNumber.from(0);
      } else {
        // Trimming goes below minMoveAmount. Cancel only if remaining withdrawals
        // + vault surplus still cover all approved deposits.
        const budgetAfterCancel = runningTotal.sub(amt).add(vaultSurplus);
        if (budgetAfterCancel.gte(totalApprovedDeposits)) {
          runningTotal = runningTotal.sub(amt);
          w.action = ACTION_NONE;
          w.reason = "no approved deposits to fund";
          _clearWithdrawalFields(w);
          excess = BigNumber.from(0);
        }
        // else: cancelling would under-fund deposits — leave as-is
      }
    }
  }

  return result;
}

/**
 * Filter allocations: withdraw → allocate deposits → trim withdrawals → fallbacks.
 *
 * Step 1 (withdrawals): filter overallocated strategies by feasibility.
 * Step 2 (deposits):    allocate budget (withdrawals + surplus) in APY-desc order,
 *                       then deploy remaining surplus to default strategy.
 * Step 3 (trim):        cancel/reduce withdrawals that no longer have deposits to fund.
 * Step 4 (fallback):    cover shortfall if no withdrawals were approved.
 *
 * @param {Array}     allocations - output of computeIdealAllocation
 * @param {BigNumber} shortfall   - vault withdrawal shortfall (after addWithdrawalQueueLiquidity offset)
 * @param {BigNumber} vaultBalance - vault idle USDC (after addWithdrawalQueueLiquidity offset)
 * @param {object}    [constraintOverrides]
 * @param {object}    [withdrawalCapacities] - from discoverWithdrawalCapacities()
 * @returns {Promise<Array>}
 */

/**
 * Compute actual impact (impactBps, expectedApy, markets) for each finalized
 * action using its real delta, replacing the stale max-capacity values.
 */
async function _computeActualImpacts(actions) {
  const active = actions.filter(
    (a) =>
      (a.action === ACTION_DEPOSIT || a.action === ACTION_WITHDRAW) &&
      a.metaMorphoVaultAddress &&
      a.morphoChainId &&
      !a.delta.isZero()
  );
  await Promise.all(
    active.map(async (a) => {
      const rpcUrl = getRpcUrl(a.morphoChainId);
      if (!rpcUrl) return;
      try {
        const includeMarkets = !a.isCrossChain && a.morphoChainId === 1;
        const result =
          a.action === ACTION_DEPOSIT
            ? await computeDepositImpactRpc(
                rpcUrl,
                a.morphoChainId,
                a.metaMorphoVaultAddress,
                a.delta.toBigInt(),
                { includeMarkets }
              )
            : await computeWithdrawalImpactRpc(
                rpcUrl,
                a.morphoChainId,
                a.metaMorphoVaultAddress,
                a.delta.abs().toBigInt(),
                { includeMarkets }
              );
        a.impactBps = result.impactBps;
        a.expectedApy = result.newApy;
        if (result.markets?.length > 0) a.markets = result.markets;
      } catch (err) {
        log(`Impact computation failed for ${a.name}: ${err.message}`);
      }
    })
  );
}

async function buildExecutableActions(
  allocations,
  shortfall = BigNumber.from(0),
  vaultBalance = BigNumber.from(0),
  constraintOverrides = {},
  withdrawalCapacities = {},
  warnings = []
) {
  const constraints = { ...ousdConstraints, ...constraintOverrides };
  let result = allocations.map((a) => ({ ...a }));

  // 1. Filter withdrawals by feasibility (min move, cross-chain min, liquidity, APY impact)
  result = _filterWithdrawals(result, constraints, withdrawalCapacities);

  // 2. Allocate deposits from available budget + deploy remaining surplus
  result = await _allocateDeposits(
    result,
    vaultBalance,
    shortfall,
    constraints,
    warnings
  );

  // 3. Cancel/trim withdrawals that exceed what approved deposits + vault deficit need
  result = _trimExcessWithdrawals(result, vaultBalance, shortfall, constraints);

  // 4. Mark approved withdrawals funding the vault deficit as isShortfall so
  //    the portfolio spread gate preserves them.
  result = _markShortfallWithdrawals(
    result,
    vaultBalance,
    shortfall,
    constraints
  );

  // 5. Fallback: cover shortfall if no withdrawals were approved
  const hasApprovedWithdrawals = result.some(
    (a) => a.action === ACTION_WITHDRAW
  );
  if (!hasApprovedWithdrawals && shortfall.gt(0)) {
    result = _coverShortfall(result, shortfall, constraints);
  }

  return result;
}

/**
 * Sort allocations by execution priority:
 *   0 - shortfall withdrawals (must run first to fund queue)
 *   1 - rebalancing withdrawals
 *   2 - deposits
 *   3 - none / AMO
 */
function sortActions(allocations) {
  const priority = (a) => {
    if (a.action === ACTION_WITHDRAW && a.isShortfall) return 0;
    if (a.action === ACTION_WITHDRAW) return 1;
    if (a.action === ACTION_DEPOSIT) return 2;
    return 3;
  };
  return [...allocations].sort((a, b) => priority(a) - priority(b));
}

/**
 * Format a USDC BigNumber as a human-readable string with commas and 2 decimal places.
 * e.g. BigNumber(1234567890000) → "1,234,567.89"
 */
function fmtUsd(bn) {
  const n = parseFloat(formatUnits(bn, USDC_DECIMALS));
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a USDC BigNumber as a short string for compact output (e.g. Discord).
 * e.g. BigNumber(1234567890000) → "$1.23M"
 */
function fmtUsdCompact(bn) {
  const n = parseFloat(formatUnits(bn, USDC_DECIMALS));
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

/**
 * Format a human-readable table of current vs recommended allocations.
 * Returns the formatted string (caller decides whether to console.log or post to Discord).
 *
 * @param {object} params
 * @param {Array}  params.actions       - filtered+sorted allocations (output of sortActions)
 * @param {Array}  params.idealActions  - ideal (unconstrained) allocations (output of computeIdealAllocation)
 * @param {BigNumber} params.vaultBalance
 * @param {BigNumber} params.shortfall
 * @param {object}  [params.constraints]
 * @param {Array}   [params.warnings]
 * @param {boolean} [params.compact]    - if true, narrow 6-column output for Discord
 * @param {object}  [params.withdrawalCapacities] - from discoverWithdrawalCapacities()
 * @returns {string}
 */
function formatAllocationTable({
  actions,
  idealActions,
  vaultBalance,
  shortfall,
  constraints: overrides = {},
  warnings = [],
  compact = false,
  baselineMarkets = [],
  portfolioApy = null,
}) {
  const COL_SEP = "  ";
  const constraints = { ...ousdConstraints, ...overrides };
  const fmt = compact ? fmtUsdCompact : (bn) => fmtUsd(bn);
  const lines = [];

  // Use idealActions for the table (shows ideal balances/APYs); fall back to feasible if absent
  const tableRows = idealActions || actions;
  const totalCapital = tableRows.reduce(
    (sum, a) => sum.add(a.balance),
    vaultBalance
  );

  // Build a lookup map: address → feasible action (for the actions sections)
  const filteredByAddr = new Map(actions.map((a) => [a.address, a]));

  lines.push("=== OUSD Rebalancer Status ===");
  lines.push("");
  lines.push(`Total rebalancable capital : ${fmtUsd(totalCapital)} USDC`);
  lines.push(`Withdrawal shortfall       : ${fmtUsd(shortfall)} USDC`);
  if (portfolioApy) {
    const pctStr = (v) => `${(v * 100).toFixed(2)}%`;
    const hasAction = actions.some((a) => a.action !== ACTION_NONE);
    if (hasAction) {
      const delta = portfolioApy.deltaBps;
      const deltaSign = delta >= 0 ? "+" : "";
      lines.push(
        `Portfolio APY (before→after): ${pctStr(portfolioApy.before)} → ` +
          `${pctStr(portfolioApy.after)}  (${deltaSign}${delta} bps)`
      );
    } else {
      lines.push(`Portfolio APY              : ${pctStr(portfolioApy.before)}`);
    }
  }

  // ── Allocations table ────────────────────────────────────────────────────
  lines.push("");
  lines.push("--- Allocations ---");
  lines.push("");

  const pct = (bn) =>
    totalCapital.gt(0)
      ? ` (${(Number(bn.mul(10000).div(totalCapital)) / 100).toFixed(1)}%)`
      : "";
  const sign = (bn) => (bn.gte(0) ? "+" : "-");

  // Vault post-action balance: current balance minus net strategy movement.
  // Derived from the actions (core logic output), not computed independently.
  const netStrategyDelta = actions
    .filter((a) => a.action === ACTION_DEPOSIT || a.action === ACTION_WITHDRAW)
    .reduce((sum, a) => sum.add(a.delta), BigNumber.from(0));
  const vaultTarget = vaultBalance.sub(netStrategyDelta);
  const vaultDelta = vaultTarget.sub(vaultBalance);

  const formattedRows = tableRows.map((a) => {
    const rec = filteredByAddr.get(a.address);
    const recTarget =
      rec && rec.action !== ACTION_NONE ? rec.targetBalance : a.balance;
    const recDelta = recTarget.sub(a.balance);
    const avgApyStr = `${(a.apy * 100).toFixed(2)}%`;
    const spotApyStr = `${(a.spotApy * 100).toFixed(2)}%`;
    const impact =
      (rec?.action === ACTION_DEPOSIT || rec?.action === ACTION_WITHDRAW) &&
      rec?.impactBps != null
        ? `${(rec.impactBps / 100).toFixed(2)}%`
        : "—";
    const expectedApy =
      rec?.expectedApy != null ? `${(rec.expectedApy * 100).toFixed(2)}%` : "—";
    return {
      name: `${a.name}${a.isDefault ? " *" : ""}${
        a.isTransferPending ? " #" : ""
      }`,
      current: `${fmt(a.balance)}${pct(a.balance)}`,
      avail:
        a.withdrawableLiquidity !== null ? fmt(a.withdrawableLiquidity) : "n/a",
      target: `${fmt(recTarget)}${pct(recTarget)}`,
      delta: `${sign(recDelta)}${fmt(recDelta.abs())}`,
      avgApy: avgApyStr,
      spotApy: spotApyStr,
      expectedApy,
      impact,
    };
  });

  const vaultRow = {
    name: "Vault (idle)",
    current: `${fmt(vaultBalance)}${pct(vaultBalance)}`,
    avail: "—",
    target: `${fmt(vaultTarget)}${pct(vaultTarget)}`,
    delta: `${sign(vaultDelta)}${fmt(vaultDelta.abs())}`,
    avgApy: "—",
    spotApy: "—",
    expectedApy: "—",
    impact: "—",
  };

  const allRows = [...formattedRows, vaultRow];

  // Column definitions: compact uses fewer columns
  const apyLabel = `${constraints.apyAverageWindow} APY`;
  const colDefs = [
    { key: "name", header: "Strategy", align: "left" },
    { key: "current", header: "Current", align: "right" },
    { key: "avail", header: "Avail.", align: "right" },
    {
      key: "target",
      header: compact ? "Target" : "Target (rec.)",
      align: "right",
    },
    { key: "delta", header: "Delta", align: "right" },
    { key: "avgApy", header: apyLabel, align: "right" },
    { key: "spotApy", header: "Spot APY", align: "right" },
    { key: "expectedApy", header: "Exp. APY", align: "right" },
    { key: "impact", header: "Impact", align: "right" },
  ];
  // const colDefs = compact ? allCols.filter((c) => c.key !== "avail") : allCols;

  // Compute column widths
  const COL = {};
  for (const col of colDefs) {
    COL[col.key] = Math.max(
      col.header.length,
      ...allRows.map((row) => row[col.key].length)
    );
  }

  const totalWidth =
    colDefs.reduce((sum, col) => sum + COL[col.key], 0) +
    COL_SEP.length * (colDefs.length - 1);

  // Render a single row using the column definitions
  const renderRow = (row) =>
    colDefs
      .map((col) =>
        col.align === "left"
          ? row[col.key].padEnd(COL[col.key])
          : row[col.key].padStart(COL[col.key])
      )
      .join(COL_SEP);

  // Header
  const headerRow = {};
  for (const col of colDefs) headerRow[col.key] = col.header;
  lines.push(renderRow(headerRow));
  lines.push("-".repeat(totalWidth));

  // Data rows
  for (const row of formattedRows) lines.push(renderRow(row));
  lines.push(renderRow(vaultRow));

  // Footer
  lines.push("-".repeat(totalWidth));
  const totalRow = {};
  for (const col of colDefs) totalRow[col.key] = "";
  totalRow.name = "Total";
  totalRow.current = fmt(totalCapital);
  lines.push(renderRow(totalRow));
  lines.push("  * = default strategy");
  if (tableRows.some((a) => a.isTransferPending)) {
    lines.push("  # = transfer pending (deposits blocked)");
  }

  // ── Recommended actions ─────────────────────────────────────────────────
  const actionRows = actions.filter((a) => a.action !== ACTION_NONE);

  lines.push("");
  lines.push("--- Recommended Actions ---");
  lines.push("");
  if (actionRows.length === 0) {
    lines.push("  No actions required.");
  } else {
    for (const a of actionRows) {
      const verb = a.action.toUpperCase();
      const dir = a.action === ACTION_WITHDRAW ? "from" : "to  ";
      const note = a.reason ? ` (${a.reason})` : "";
      const amount = compact
        ? fmtUsdCompact(a.delta.abs())
        : `$${fmtUsd(a.delta.abs())}`;
      lines.push(
        `  ${verb.padEnd(8)} ${amount.padStart(compact ? 9 : 17)}  ${dir}  ${
          a.name
        }${note}`
      );
    }
  }

  // ── Ethereum Morpho market details ──────────────────────────────────────
  // Use impact data from an active action if available, otherwise fall back
  // to baseline APY data so market details always appear.
  const marketAction = actions.find((a) => a.markets && a.markets.length > 0);
  const markets =
    marketAction?.markets ||
    (baselineMarkets.length > 0 ? baselineMarkets : null);
  if (markets && markets.length > 0) {
    const oeth = markets.find((m) => m.marketId === OETH_USDC_MARKET_ID);
    const wsteth = markets.find((m) => m.marketId === WSTETH_USDC_MARKET_ID);
    if (oeth || wsteth) {
      // Show Post columns only when Ethereum Morpho has a non-zero delta
      const ethMorphoRec = filteredByAddr.get(
        addresses.mainnet.MorphoOUSDv2StrategyProxy
      );
      const hasChange =
        ethMorphoRec &&
        ethMorphoRec.action !== ACTION_NONE &&
        !ethMorphoRec.delta.isZero();

      const fmtPct = (v) => (v != null ? `${(v * 100).toFixed(2)}%` : "—");
      const MC = { name: 14, cur: 10, sim: 10, curApy: 10, simApy: 10 };
      const MS = "  ";

      lines.push("");
      lines.push("--- Ethereum Morpho Market Details ---");
      lines.push("");

      if (hasChange) {
        lines.push(
          `  ${"Market".padEnd(MC.name)}${MS}${"Cur Util".padStart(
            MC.cur
          )}${MS}${"Post Util".padStart(MC.sim)}${MS}${"Cur APY".padStart(
            MC.curApy
          )}${MS}${"Post APY".padStart(MC.simApy)}`
        );
        for (const [label, m] of [
          ["OETH/USDC", oeth],
          ["wstETH/USDC", wsteth],
        ]) {
          if (!m) continue;
          lines.push(
            `  ${label.padEnd(MC.name)}${MS}${fmtPct(
              m.current.utilization
            ).padStart(MC.cur)}${MS}${fmtPct(m.simulated.utilization).padStart(
              MC.sim
            )}${MS}${fmtPct(m.current.supplyApy).padStart(
              MC.curApy
            )}${MS}${fmtPct(m.simulated.supplyApy).padStart(MC.simApy)}`
          );
        }
      } else {
        lines.push(
          `  ${"Market".padEnd(MC.name)}${MS}${"Util".padStart(
            MC.cur
          )}${MS}${"APY".padStart(MC.curApy)}`
        );
        for (const [label, m] of [
          ["OETH/USDC", oeth],
          ["wstETH/USDC", wsteth],
        ]) {
          if (!m) continue;
          lines.push(
            `  ${label.padEnd(MC.name)}${MS}${fmtPct(
              m.current.utilization
            ).padStart(MC.cur)}${MS}${fmtPct(m.current.supplyApy).padStart(
              MC.curApy
            )}`
          );
        }
      }
    }
  }

  if (warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const w of warnings) {
      lines.push(`  ${w}`);
    }
  }

  return lines.join("\n");
}

/**
 * Separate strategies with suspiciously high APY from the active pool.
 * Excluded strategies are frozen in place (no funds move to or from them).
 */
function _filterExcludedStrategies(strategies, apys, constraints) {
  const active = [];
  const excluded = [];
  const warnings = [];
  for (const s of strategies) {
    const apy = apys[s.metaMorphoVaultAddress] || 0;
    if (apy > constraints.maxApyThreshold) {
      const msg =
        `${s.name} APY ${(apy * 100).toFixed(0)}% exceeds ` +
        `threshold ${(constraints.maxApyThreshold * 100).toFixed(
          0
        )}% — excluded from allocation`;
      log(`WARNING: ${msg}`);
      warnings.push(msg);
      excluded.push(s);
    } else {
      active.push(s);
    }
  }
  return { active, excluded, warnings };
}

/**
 * Fetch the immediately withdrawable amount for each strategy.
 *
 * - Same-chain (Ethereum Morpho V2): call strategy.maxWithdraw() on the mainnet provider.
 * - Cross-chain: replicate MorphoV2VaultUtils.maxWithdrawableAssets() — sum USDC idle on
 *   VaultV2 + MetaMorphoV1.1.maxWithdraw(adapter). VaultV2's ERC-4626 maxWithdraw(owner)
 *   does not traverse the adapter chain, so we must query each layer separately.
 * - If the required provider is unavailable, the entry is omitted and no constraint is applied.
 *
 * @param {Array}  strategies - strategy config objects (from ousdMorphoStrategiesConfig)
 * @returns {object} { [strategyAddress]: BigNumber } map of withdrawable amounts
 */
async function fetchMaxWithdrawals(strategies) {
  const results = {};
  await Promise.all(
    strategies.map(async (s) => {
      try {
        if (!s.isCrossChain) {
          const provider = getProvider(1);
          if (!provider) return;
          const contract = new ethers.Contract(
            s.address,
            maxWithdrawAbi,
            provider
          );
          results[s.address] = await contract.maxWithdraw();
        } else {
          // Cross-chain: replicate MorphoV2VaultUtils.maxWithdrawableAssets()
          // VaultV2's ERC-4626 maxWithdraw(owner) doesn't traverse the adapter
          // chain, so we manually sum idle USDC + adapter's MetaMorpho V1.1 liquidity.
          const provider = getProvider(s.morphoChainId);
          if (!provider) return;
          const remoteStrategy = new ethers.Contract(
            s.address,
            platformAddressAbi,
            provider
          );
          const vaultV2Addr = await remoteStrategy.platformAddress();

          // 1. USDC idle on VaultV2
          const usdcAddr = USDC_BY_CHAIN[s.morphoChainId];
          const usdcOnVault = await new ethers.Contract(
            usdcAddr,
            erc20Abi,
            provider
          ).balanceOf(vaultV2Addr);

          // 2. Adapter's available liquidity from MetaMorpho V1.1
          const adapter = await new ethers.Contract(
            vaultV2Addr,
            liquidityAdapterAbi,
            provider
          ).liquidityAdapter();
          const adapterLiquidity = await new ethers.Contract(
            s.metaMorphoVaultAddress,
            erc4626MaxWithdrawAbi,
            provider
          ).maxWithdraw(adapter);

          // 3. Total available = idle + adapter liquidity (matches on-chain logic)
          results[s.address] = usdcOnVault.add(adapterLiquidity);
        }
      } catch (err) {
        log(`fetchMaxWithdrawals failed for ${s.name}: ${err.message}`);
        // Entry omitted — no liquidity constraint applied for this strategy
      }
    })
  );
  return results;
}

/**
 * Main entry: read state, fetch APYs, compute allocations, print table.
 *
 * Reads RPC URLs and providers from rebalancer-config (via initSecrets / process.env).
 */
async function buildRebalancePlan(simulation) {
  log("Reading on-chain state...");
  const state = await readOnChainState();

  // Apply simulation overrides (balance adjustments in whole-dollar USDC)
  if (simulation) {
    const parts = [];
    if (simulation.vault != null) {
      const delta = parseUnits(
        Math.abs(simulation.vault).toString(),
        USDC_DECIMALS
      );
      state.vaultBalance =
        simulation.vault >= 0
          ? state.vaultBalance.add(delta)
          : state.vaultBalance.sub(delta);
      parts.push(`Vault ${simulation.vault >= 0 ? "+" : "-"}$${fmtUsd(delta)}`);
    }
    for (const s of state.strategies) {
      if (simulation[s.name] != null) {
        const amt = simulation[s.name];
        const delta = parseUnits(Math.abs(amt).toString(), USDC_DECIMALS);
        s.balance = amt >= 0 ? s.balance.add(delta) : s.balance.sub(delta);
        parts.push(`${s.name} ${amt >= 0 ? "+" : "-"}$${fmtUsd(delta)}`);
      }
    }
    if (parts.length > 0) {
      console.log(
        `\nSIMULATION MODE — balances adjusted: ${parts.join(", ")}\n`
      );
    }
  }

  log("Fetching Morpho APYs...");
  const {
    apys: spotApys,
    avgApys,
    marketDetails,
  } = await fetchMorphoApys(
    state.strategies.filter((s) => s.metaMorphoVaultAddress),
    { timeWindow: ousdConstraints.apyAverageWindow }
  );

  log("Fetching withdrawable liquidity...");
  const maxWithdrawals = await fetchMaxWithdrawals(state.strategies);

  // Exclude strategies with suspiciously high APY (based on time-windowed average)
  const { active, excluded, warnings } = _filterExcludedStrategies(
    state.strategies,
    avgApys,
    ousdConstraints
  );

  // Discover withdrawal capacities (needed for allocation floors + execution)
  let withdrawalCapacities = {};
  if (!process.env.IS_TEST) {
    log("Discovering withdrawal capacities...");
    withdrawalCapacities = await discoverWithdrawalCapacities(
      active,
      ousdConstraints
    );
  }

  // Compute allocation: impact-aware step-wise in production, static APY in tests
  let idealActive;
  if (!process.env.IS_TEST) {
    log("Computing impact-aware allocation...");
    idealActive = await computeImpactAwareAllocation({
      strategies: active,
      apys: avgApys,
      spotApys,
      vaultBalance: state.vaultBalance,
      shortfall: state.shortfall,
      withdrawalCapacities,
    });
  } else {
    idealActive = computeIdealAllocation({
      strategies: active,
      apys: avgApys,
      spotApys,
      vaultBalance: state.vaultBalance,
      shortfall: state.shortfall,
      withdrawalCapacities,
    });
  }

  // Build frozen rows for excluded strategies
  const idealExcluded = excluded.map((s) => {
    const row = _buildAllocationRow(
      s,
      s.balance,
      avgApys[s.metaMorphoVaultAddress] || 0,
      spotApys[s.metaMorphoVaultAddress] || 0
    );
    row.reason = "APY exceeds threshold";
    return row;
  });

  const idealActions = [...idealActive, ...idealExcluded];

  // Build baseline market data for display fallback (when no action has impact data).
  const ethMd = marketDetails[addresses.mainnet.MorphoOUSDv1Vault];
  const baselineMarkets = ethMd
    ? ethMd.map((d) => ({
        marketId: d.marketId,
        current: { supplyApy: d.supplyApy, utilization: d.utilization },
        simulated: { supplyApy: d.supplyApy, utilization: d.utilization },
      }))
    : [];

  // Merge withdrawable liquidity into rows before feasibility filtering
  for (const row of idealActions) {
    if (maxWithdrawals[row.address] !== undefined) {
      row.withdrawableLiquidity = maxWithdrawals[row.address];
    }
  }

  const executableActions = await buildExecutableActions(
    idealActions,
    state.shortfall,
    state.vaultBalance,
    {},
    withdrawalCapacities,
    warnings
  );
  const actions = sortActions(executableActions);

  // Compute actual impact for finalized actions (correct values for display)
  if (!process.env.IS_TEST) {
    log("Computing actual impact for finalized actions...");
    await _computeActualImpacts(actions);
  }

  // Portfolio-level APY spread gate: if the rebalance doesn't lift weighted
  // portfolio APY by at least minApySpread, drop yield-motivated actions.
  const totalCapital = actions.reduce(
    (sum, a) => sum.add(a.balance),
    state.vaultBalance
  );
  const portfolioApy = _applyPortfolioSpreadGate(
    actions,
    totalCapital,
    ousdConstraints,
    warnings
  );

  console.log(
    formatAllocationTable({
      actions,
      idealActions,
      vaultBalance: state.vaultBalance,
      shortfall: state.shortfall,
      warnings,
      baselineMarkets,
      portfolioApy,
    })
  );

  return {
    actions,
    idealActions,
    state,
    apys: avgApys,
    spotApys,
    warnings,
    withdrawalCapacities,
    baselineMarkets,
    portfolioApy,
  };
}

module.exports = {
  computeAvailableBalance,
  computeIdealAllocation,
  computeImpactAwareAllocation,
  buildExecutableActions,
  sortActions,
  fmtUsd,
  formatAllocationTable,
  buildRebalancePlan,
  computePortfolioApy,
  _applyPortfolioSpreadGate,
  _markShortfallWithdrawals,
  ousdMorphoStrategiesConfig,
  ousdConstraints,
  ACTION_DEPOSIT,
  ACTION_WITHDRAW,
  ACTION_NONE,
};
