const { ethers, BigNumber } = require("ethers");
const { formatUnits } = require("ethers/lib/utils");

const addresses = require("./addresses");

const {
  ousdMorphoStrategiesConfig,
  ousdConstraints,
} = require("./rebalancer-config");
const { fetchMorphoApys, fetchSubsquidDepositImpact } = require("./morpho-apy");

const log = require("./logger")("utils:rebalancer");

const USDC_DECIMALS = 6;

// USDC token address per chain (used by fetchMaxWithdrawals for cross-chain liquidity reads)
const USDC_BY_CHAIN = {
  1: addresses.mainnet.USDC,
  8453: addresses.base.USDC,
  999: addresses.hyperevm.USDC,
};

// Action constants shared with Defender Actions and tests
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
 * Read on-chain state: Morpho strategy balances, vault idle USDC, withdrawal queue.
 * @param {object} provider - ethers provider
 * @returns {object} { strategies, vaultBalance, shortfall }
 */
async function readOnChainState(provider) {
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

  // Reserve any available vault balance for pending withdrawals
  let shortfall = queueMeta.queued.sub(queueMeta.claimable);
  let availableVaultBalance = vaultBalance;
  if (shortfall.gt(0) && vaultBalance.gt(0)) {
    if (shortfall.lt(vaultBalance)) {
      // This will be reserved the next time `addWithdrawalQueueLiquidity` is called
      availableVaultBalance = vaultBalance.sub(shortfall);
      shortfall = BigNumber.from(0);
    } else {
      // This will be reserved the next time `addWithdrawalQueueLiquidity` is called
      availableVaultBalance = BigNumber.from(0);
      shortfall = shortfall.sub(vaultBalance);
    }
  }

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
 * maxAllocationBps (and deposit capacity if known).
 * Returns a plain object { [address]: BigNumber } of target balances.
 */
function _greedyFillByApy(
  strategies,
  deployableCapital,
  strategyApyOf,
  depositCapacities = {}
) {
  const sorted = [...strategies].sort(
    (a, b) => strategyApyOf(b) - strategyApyOf(a)
  );

  const targets = {};
  for (const s of strategies) targets[s.address] = BigNumber.from(0);

  let remaining = deployableCapital;
  for (const s of sorted) {
    const maxBps = s.maxAllocationBps != null ? s.maxAllocationBps : 10000;
    const maxAllocationAmt = deployableCapital.mul(maxBps).div(10000);

    // Cap to deposit capacity: current balance + maxDeposit
    const cap = depositCapacities[s.metaMorphoVaultAddress];
    let effectiveMax = maxAllocationAmt;
    if (cap && cap.maxDeposit) {
      const capacityCap = s.balance.add(cap.maxDeposit);
      if (capacityCap.lt(effectiveMax)) {
        effectiveMax = capacityCap;
      }
    }

    const alloc = remaining.lt(effectiveMax) ? remaining : effectiveMax;
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
function _enforceStrategyMinimums(targets, strategies, deployableCapital) {
  // Collect strategies that are below their minimum
  const belowMin = strategies.filter((s) => {
    const minBps = s.minAllocationBps || 0;
    if (minBps === 0) return false;
    const minAmt = deployableCapital.mul(minBps).div(10000);
    return targets[s.address].lt(minAmt);
  });

  for (const under of belowMin) {
    const minAmt = deployableCapital.mul(under.minAllocationBps).div(10000);
    const deficit = minAmt.sub(targets[under.address]);
    targets[under.address] = minAmt;

    // Claw back from highest-allocated strategies (excluding those at/below their own min)
    const sorted = [...strategies]
      .filter((s) => s.address !== under.address)
      .sort((a, b) => (targets[b.address].gt(targets[a.address]) ? 1 : -1));

    let toReduce = deficit;
    for (const s of sorted) {
      const sMinAmt = deployableCapital.mul(s.minAllocationBps || 0).div(10000);
      const available = targets[s.address].sub(sMinAmt);
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
 * Deposit capacity (from discoverDepositCapacities) further constrains allocation.
 *
 * @param {object} params
 * @param {Array}  params.strategies
 * @param {object} params.apys - metaMorphoVaultAddress -> apy (float, on-chain)
 * @param {object} [params.spotApys] - metaMorphoVaultAddress -> spot apy (float, instantaneous)
 * @param {BigNumber} params.vaultBalance
 * @param {BigNumber} params.shortfall
 * @param {object} [params.constraints]
 * @param {object} [params.depositCapacities] - from discoverDepositCapacities()
 * @returns {Array} allocation results
 */
function computeIdealAllocation({
  strategies,
  apys,
  spotApys = {},
  vaultBalance,
  shortfall,
  constraints: overrides = {},
  depositCapacities = {},
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
    strategyApyOf,
    depositCapacities
  );
  const adjusted = _enforceStrategyMinimums(
    targets,
    strategies,
    deployableCapital
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
 * Binary search for the maximum deposit amount where impactBps ≤ maxApyImpactBps.
 * Rounds to depositStepSize increments. ~4-5 API calls per strategy.
 *
 * @param {string}    vaultAddress - MetaMorpho vault address
 * @param {number}    chainId
 * @param {BigNumber} maxAmt      - upper bound (from allocation cap)
 * @param {object}    constraints
 * @returns {{ maxDeposit: BigNumber, impactBps: number, postDepositApy: number }}
 */
async function _findMaxDeposit(vaultAddress, chainId, maxAmt, constraints) {
  const step = BigNumber.from(constraints.depositStepSize);

  // Fast path: check full amount first
  const full = await fetchSubsquidDepositImpact(vaultAddress, chainId, maxAmt);
  if (full.impactBps <= constraints.maxApyImpactBps) {
    return {
      maxDeposit: maxAmt,
      impactBps: full.impactBps,
      postDepositApy: full.newApy,
    };
  }

  const minMove = BigNumber.from(constraints.minMoveAmount);

  // For narrow ranges (maxAmt < 2×step), step-aligned rounding collapses mid to 0.
  // Fall back to minMoveAmount as the step so the search can still make progress.
  const effectiveStep = maxAmt.lt(step.mul(2)) ? minMove : step;

  // Binary search for the largest deposit within the APY impact threshold
  let lo = minMove;
  let hi = maxAmt;
  let best = { maxDeposit: BigNumber.from(0), impactBps: 0, postDepositApy: 0 };

  while (hi.sub(lo).gte(effectiveStep)) {
    const mid = lo.add(hi).div(2).div(effectiveStep).mul(effectiveStep);
    if (mid.lt(lo)) break;

    const { impactBps, newApy } = await fetchSubsquidDepositImpact(
      vaultAddress,
      chainId,
      mid
    );
    if (impactBps <= constraints.maxApyImpactBps) {
      best = { maxDeposit: mid, impactBps, postDepositApy: newApy };
      lo = mid.add(effectiveStep);
    } else {
      hi = mid;
    }
  }

  // Probe minMoveAmount if search found nothing — verifies feasibility at the floor
  if (best.maxDeposit.isZero()) {
    const { impactBps, newApy } = await fetchSubsquidDepositImpact(
      vaultAddress,
      chainId,
      minMove
    );
    if (impactBps <= constraints.maxApyImpactBps) {
      best = { maxDeposit: minMove, impactBps, postDepositApy: newApy };
    }
  }
  return best;
}

/**
 * Discover the maximum deposit amount per strategy that keeps APY impact within
 * the threshold. Called before allocation so capacities can be factored in.
 *
 * @param {Array}     strategies       - strategy config objects with balance
 * @param {BigNumber} deployableCapital
 * @param {object}    constraints
 * @returns {object} { [metaMorphoVaultAddress]: { maxDeposit, postDepositApy, impactBps } }
 */
async function discoverDepositCapacities(
  strategies,
  deployableCapital,
  constraints
) {
  const capacities = {};
  await Promise.all(
    strategies.map(async (s) => {
      if (!s.metaMorphoVaultAddress || !s.morphoChainId) return;
      try {
        const maxBps = s.maxAllocationBps != null ? s.maxAllocationBps : 10000;
        const maxPossible = deployableCapital
          .mul(maxBps)
          .div(10000)
          .sub(s.balance);
        if (maxPossible.lt(constraints.minMoveAmount)) {
          capacities[s.metaMorphoVaultAddress] = {
            maxDeposit: BigNumber.from(0),
            postDepositApy: 0,
            impactBps: 0,
          };
          return;
        }
        const result = await _findMaxDeposit(
          s.metaMorphoVaultAddress,
          s.morphoChainId,
          maxPossible,
          constraints
        );
        capacities[s.metaMorphoVaultAddress] = result;
        log(
          `Deposit capacity for ${s.name}: ${fmtUsd(result.maxDeposit)} ` +
            `(impact ${result.impactBps}bps, post-deposit APY ${(
              result.postDepositApy * 100
            ).toFixed(2)}%)`
        );
      } catch (err) {
        log(`Deposit capacity discovery failed for ${s.name}: ${err.message}`);
        // Fail-closed: if we can't determine capacity, don't allow deposits.
        // A partial Subsquid outage should not bypass the APY impact guard.
        capacities[s.metaMorphoVaultAddress] = {
          maxDeposit: BigNumber.from(0),
          postDepositApy: 0,
          impactBps: 0,
        };
      }
    })
  );
  return capacities;
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
 * Filter withdrawals by feasibility: min move amount, cross-chain min, liquidity.
 * Infeasible withdrawals are set to ACTION_NONE with a reason.
 *
 * Note: APY spread check has moved to _resolveDeposit (post-impact spread).
 * Per-strategy minAllocationBps prevents over-withdrawing from important strategies.
 */
function _filterWithdrawals(result, constraints) {
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
 * Resolve a single deposit: early-exit checks, cap, split surplus/withdrawal,
 * spread-check, min-check. Returns result without mutating deposit.
 *
 * @returns {{ rejected: boolean, amt?, reason?, surplusUsed?, impactBps?, warn? }}
 */
function _resolveDeposit(
  deposit,
  budget,
  surplusBudget,
  highestWithdrawalApy,
  constraints,
  capacity
) {
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

  // Cap to available budget and deposit capacity
  let amt = deposit.delta.gt(budget) ? budget : deposit.delta;
  let reason = null;

  if (capacity && capacity.maxDeposit.gt(0) && amt.gt(capacity.maxDeposit)) {
    amt = capacity.maxDeposit;
    reason = `capped to deposit capacity: ${fmtUsd(amt)}`;
  }

  // Split into surplus-funded and withdrawal-funded portions
  const surplusPortion = surplusBudget.lt(amt) ? surplusBudget : amt;

  // Spread check on withdrawal-funded portion only
  // Surplus earns 0% in the vault — any positive APY is a win, no spread needed.
  let spreadNarrowed = false;
  if (
    amt.gt(surplusPortion) &&
    highestWithdrawalApy != null &&
    constraints.minApySpread
  ) {
    const postDepositApy = capacity?.postDepositApy;
    if (postDepositApy != null) {
      const spread = postDepositApy - highestWithdrawalApy;
      if (spread < constraints.minApySpread) {
        amt = surplusPortion;
        spreadNarrowed = true;
      }
    }
  }

  // Format spread reason (reused for both rejection and approval paths)
  const spreadReason =
    spreadNarrowed && capacity?.postDepositApy != null
      ? `post-impact spread ${(
          (capacity.postDepositApy - highestWithdrawalApy) *
          100
        ).toFixed(2)}% < min ${(constraints.minApySpread * 100).toFixed(2)}%`
      : null;

  // Single min-amount check
  if (amt.lt(constraints.minMoveAmount)) {
    if (capacity && capacity.maxDeposit.isZero()) {
      return {
        rejected: true,
        reason: "APY impact too high even at minimum amount",
      };
    }
    return { rejected: true, reason: spreadReason || "below min move" };
  }
  if (deposit.isCrossChain && amt.lt(constraints.crossChainMinAmount)) {
    return { rejected: true, reason: spreadReason || "below cross-chain min" };
  }

  // Approved — determine reason
  if (amt.lt(deposit.delta)) {
    if (spreadNarrowed) {
      reason = `trimmed to vault surplus (${spreadReason})`;
    } else if (!reason) {
      reason = "trimmed to available vault funds";
    }
  }

  const surplusUsed = amt.gt(surplusBudget) ? surplusBudget : amt;
  return {
    rejected: false,
    amt,
    reason,
    surplusUsed,
    impactBps: capacity?.impactBps,
  };
}

/**
 * Deploy remaining vault surplus to the default strategy.
 */
function _deployRemainingSurplus(result, surplus) {
  const defaultStrategy = result.find(
    (a) => a.isDefault && a.reason !== "APY exceeds threshold"
  );
  if (!defaultStrategy) return;

  if (defaultStrategy.action === ACTION_DEPOSIT) {
    defaultStrategy.delta = defaultStrategy.delta.add(surplus);
    defaultStrategy.targetBalance = defaultStrategy.targetBalance.add(surplus);
    defaultStrategy.reason = defaultStrategy.reason
      ? `${defaultStrategy.reason}; +vault surplus fallback`
      : "vault surplus fallback";
  } else if (defaultStrategy.action !== ACTION_WITHDRAW) {
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
  depositCapacities,
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

  const highestWithdrawalApy =
    approvedWithdrawals.length > 0
      ? Math.max(...approvedWithdrawals.map((w) => w.apy))
      : null;

  const deposits = result
    .filter((a) => a.action === ACTION_DEPOSIT)
    .sort((a, b) => b.apy - a.apy);

  for (const deposit of deposits) {
    const capacity = depositCapacities[deposit.metaMorphoVaultAddress];
    const res = _resolveDeposit(
      deposit,
      budget,
      surplusBudget,
      highestWithdrawalApy,
      constraints,
      capacity
    );

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
    if (res.impactBps != null) deposit.impactBps = res.impactBps;
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

  const totalNeeded = totalApprovedDeposits.add(vaultDeficit);

  const withdrawals = result.filter((a) => a.action === ACTION_WITHDRAW);
  const totalApprovedWithdrawals = withdrawals.reduce(
    (sum, a) => sum.add(a.delta.abs()),
    BigNumber.from(0)
  );

  let excess = totalApprovedWithdrawals.sub(totalNeeded);
  if (excess.lte(0)) return result;

  const vaultSurplus = vaultBalance.gt(vaultTarget)
    ? vaultBalance.sub(vaultTarget)
    : BigNumber.from(0);

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
 * @param {object}    [depositCapacities] - from discoverDepositCapacities()
 * @returns {Promise<Array>}
 */
async function buildExecutableActions(
  allocations,
  shortfall = BigNumber.from(0),
  vaultBalance = BigNumber.from(0),
  constraintOverrides = {},
  depositCapacities = {},
  warnings = []
) {
  const constraints = { ...ousdConstraints, ...constraintOverrides };
  let result = allocations.map((a) => ({ ...a }));

  // 1. Filter withdrawals by feasibility (min move, cross-chain min, liquidity)
  result = _filterWithdrawals(result, constraints);

  // 2. Allocate deposits from available budget + deploy remaining surplus
  result = await _allocateDeposits(
    result,
    vaultBalance,
    shortfall,
    constraints,
    depositCapacities,
    warnings
  );

  // 3. Cancel/trim withdrawals that exceed what approved deposits + vault deficit need
  result = _trimExcessWithdrawals(result, vaultBalance, shortfall, constraints);

  // 4. Fallback: cover shortfall if no withdrawals were approved
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
    if (a.action === ACTION_WITHDRAW && a.reason?.includes("shortfall"))
      return 0;
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
 * Print a human-readable table of current vs recommended allocations.
 *
 * @param {object} params
 * @param {Array}  params.actions         - filtered+sorted allocations (output of sortActions)
 * @param {Array}  params.idealActions  - ideal (unconstrained) allocations (output of computeIdealAllocation)
 * @param {BigNumber} params.vaultBalance
 * @param {BigNumber} params.shortfall
 * @param {object} [params.constraints]
 */
function printAllocationTable({
  actions,
  idealActions,
  vaultBalance,
  shortfall,
  constraints: overrides = {},
  warnings = [],
}) {
  const COL_SEP = "  ";
  const constraints = { ...ousdConstraints, ...overrides };

  // Use idealActions for the table (shows ideal balances/APYs); fall back to feasible if absent
  const tableRows = idealActions || actions;
  const totalCapital = tableRows.reduce(
    (sum, a) => sum.add(a.balance),
    vaultBalance
  );

  // Build a lookup map: address → feasible action (for the actions sections)
  const filteredByAddr = new Map(actions.map((a) => [a.address, a]));

  console.log("\n=== OUSD Rebalancer Status ===\n");
  console.log(`Total rebalancable capital : ${fmtUsd(totalCapital)} USDC`);
  console.log(`Withdrawal shortfall       : ${fmtUsd(shortfall)} USDC`);

  // ── Allocations table: shows recommended targets from actions ────────────
  console.log("\n--- Allocations ---\n");
  const pct = (bn) =>
    totalCapital.gt(0)
      ? ` (${(Number(bn.mul(10000).div(totalCapital)) / 100).toFixed(1)}%)`
      : "";
  const sign = (bn) => (bn.gte(0) ? "+" : "-");

  // Vault (idle) row
  const vaultTarget = shortfall.add(
    BigNumber.from(constraints.minVaultBalance)
  );
  const vaultDelta = vaultTarget.sub(vaultBalance);
  const vaultDeltaSign = sign(vaultDelta);
  const formattedRows = tableRows.map((a) => {
    const rec = filteredByAddr.get(a.address);
    // Recommended target: use the feasible action's target if an action is approved,
    // otherwise fall back to the current balance (no change recommended)
    const recTarget =
      rec && rec.action !== ACTION_NONE ? rec.targetBalance : a.balance;
    const recDelta = recTarget.sub(a.balance);
    const avgApyStr = `${(a.apy * 100).toFixed(2)}%`;
    const spotApyStr = `${(a.spotApy * 100).toFixed(2)}%`;
    const impact =
      rec?.action === ACTION_DEPOSIT && rec?.impactBps != null
        ? `${(rec.impactBps / 100).toFixed(2)}%`
        : "—";
    return {
      name: `${a.name}${a.isDefault ? " *" : ""}`,
      current: `${fmtUsd(a.balance)}${pct(a.balance)}`,
      avail:
        a.withdrawableLiquidity !== null
          ? fmtUsd(a.withdrawableLiquidity)
          : "n/a",
      target: `${fmtUsd(recTarget)}${pct(recTarget)}`,
      delta: `${sign(recDelta)}${fmtUsd(recDelta.abs())}`,
      avgApy: avgApyStr,
      spotApy: spotApyStr,
      impact,
    };
  });
  const vaultRow = {
    name: "Vault (idle)",
    current: `${fmtUsd(vaultBalance)}${pct(vaultBalance)}`,
    avail: "—",
    target: `${fmtUsd(vaultTarget)}${pct(vaultTarget)}`,
    delta: `${vaultDeltaSign}${fmtUsd(vaultDelta.abs())}`,
    avgApy: "—",
    spotApy: "—",
    impact: "—",
  };
  const allRows = [...formattedRows, vaultRow];
  const COL = {
    name: Math.max("Strategy".length, ...allRows.map((row) => row.name.length)),
    current: Math.max(
      "Current".length,
      ...allRows.map((row) => row.current.length)
    ),
    avail: Math.max("Avail.".length, ...allRows.map((row) => row.avail.length)),
    target: Math.max(
      "Target (rec.)".length,
      ...allRows.map((row) => row.target.length)
    ),
    delta: Math.max("Delta".length, ...allRows.map((row) => row.delta.length)),
    avgApy: Math.max(
      `${constraints.apyAverageWindow} APY`.length,
      ...allRows.map((row) => row.avgApy.length)
    ),
    spotApy: Math.max(
      "Spot APY".length,
      ...allRows.map((row) => row.spotApy.length)
    ),
    impact: Math.max(
      "Impact".length,
      ...allRows.map((row) => row.impact.length)
    ),
  };

  const totalWidth =
    COL.name +
    COL.current +
    COL.avail +
    COL.target +
    COL.delta +
    COL.avgApy +
    COL.spotApy +
    COL.impact +
    COL_SEP.length * 7;

  console.log(
    `${"Strategy".padEnd(COL.name)}${COL_SEP}${"Current".padStart(
      COL.current
    )}${COL_SEP}${"Avail.".padStart(
      COL.avail
    )}${COL_SEP}${"Target (rec.)".padStart(
      COL.target
    )}${COL_SEP}${"Delta".padStart(
      COL.delta
    )}${COL_SEP}${`${constraints.apyAverageWindow} APY`.padStart(
      COL.avgApy
    )}${COL_SEP}${"Spot APY".padStart(
      COL.spotApy
    )}${COL_SEP}${"Impact".padStart(COL.impact)}`
  );
  console.log("-".repeat(totalWidth));

  for (const row of formattedRows) {
    console.log(
      `${row.name.padEnd(COL.name)}${COL_SEP}` +
        `${row.current.padStart(COL.current)}${COL_SEP}` +
        `${row.avail.padStart(COL.avail)}${COL_SEP}` +
        `${row.target.padStart(COL.target)}${COL_SEP}` +
        `${row.delta.padStart(COL.delta)}${COL_SEP}` +
        `${row.avgApy.padStart(COL.avgApy)}${COL_SEP}` +
        `${row.spotApy.padStart(COL.spotApy)}${COL_SEP}` +
        `${row.impact.padStart(COL.impact)}`
    );
  }

  console.log(
    `${vaultRow.name.padEnd(COL.name)}${COL_SEP}` +
      `${vaultRow.current.padStart(COL.current)}${COL_SEP}` +
      `${vaultRow.avail.padStart(COL.avail)}${COL_SEP}` +
      `${vaultRow.target.padStart(COL.target)}${COL_SEP}` +
      `${vaultRow.delta.padStart(COL.delta)}${COL_SEP}` +
      `${vaultRow.avgApy.padStart(COL.avgApy)}${COL_SEP}` +
      `${vaultRow.spotApy.padStart(COL.spotApy)}${COL_SEP}` +
      `${vaultRow.impact.padStart(COL.impact)}`
  );

  console.log("-".repeat(totalWidth));
  console.log(
    `${"Total".padEnd(COL.name)}${COL_SEP}${fmtUsd(totalCapital).padStart(
      COL.current
    )}`
  );
  console.log("  * = default strategy\n");

  // ── Section 1: All ideal allocation changes ──────────────────────────────
  const rawChanges = tableRows.filter((a) => !a.delta.isZero());

  console.log("--- Actions for max APY ---\n");
  if (rawChanges.length === 0) {
    console.log("  All strategies at target.\n");
  } else {
    for (const raw of rawChanges) {
      const verb = raw.delta.lt(0) ? "WITHDRAW" : "DEPOSIT";
      const dir = raw.delta.lt(0) ? "from" : "to  ";
      const filtered = filteredByAddr.get(raw.address);
      const isApproved = filtered && filtered.action !== ACTION_NONE;
      const wasTrimmed = isApproved && filtered.delta.abs().lt(raw.delta.abs());

      let suffix = "";
      if (!isApproved && filtered?.reason) {
        suffix = ` [Not recommended: ${filtered.reason}]`;
      } else if (wasTrimmed) {
        suffix = ` [Infeasible unless adjusted to ${fmtUsd(
          filtered.delta.abs()
        )}]`;
      } else if (raw.delta.gt(0) && filtered?.impactBps != null) {
        suffix = ` (APY impact: ${(filtered.impactBps / 100).toFixed(2)}%)`;
      }

      console.log(
        `  ${verb.padEnd(8)} $${fmtUsd(raw.delta.abs()).padStart(
          16
        )}  ${dir}  ${raw.name}${suffix}`
      );
    }
    console.log();
  }

  // ── Section 2: Recommended actions ────────────────────────────────────────
  const actionRows = actions.filter((a) => a.action !== ACTION_NONE);

  console.log("--- Recommended Actions ---\n");
  if (actionRows.length === 0) {
    console.log("  No actions required.\n");
  } else {
    for (const a of actionRows) {
      const verb = a.action.toUpperCase();
      const dir = a.action === ACTION_WITHDRAW ? "from" : "to  ";
      const note = a.reason ? ` (${a.reason})` : "";
      console.log(
        `  ${verb.padEnd(8)} $${fmtUsd(a.delta.abs()).padStart(16)}  ${dir}  ${
          a.name
        }${note}`
      );
    }
    console.log();
  }

  if (warnings.length > 0) {
    log("\n⚠️  Warnings:");
    for (const w of warnings) {
      log(`  ${w}`);
    }
  }
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
 * @param {object} providers  - { [chainId]: ethers.providers.Provider }
 * @returns {object} { [strategyAddress]: BigNumber } map of withdrawable amounts
 */
async function fetchMaxWithdrawals(strategies, providers = {}) {
  const results = {};
  await Promise.all(
    strategies.map(async (s) => {
      try {
        if (!s.isCrossChain) {
          const provider = providers[1];
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
          const provider = providers[s.morphoChainId];
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
        console.error(
          `fetchMaxWithdrawals failed for ${s.name}: ${err.message}`
        );
        // Entry omitted — no liquidity constraint applied for this strategy
      }
    })
  );
  return results;
}

/**
 * Main entry: read state, fetch APYs, compute allocations, print table.
 *
 * @param {object} providers - { [chainId]: ethersProvider }
 *   providers[1] is used for mainnet vault/strategy reads.
 *   providers[cfg.morphoChainId] is used for on-chain Morpho APY reads.
 */
async function buildRebalancePlan(providers) {
  // Accept either a providers map { [chainId]: provider } or a legacy single provider
  const providerMap =
    providers && typeof providers.getNetwork === "function"
      ? { 1: providers }
      : providers || {};

  log("Reading on-chain state...");
  const state = await readOnChainState(providerMap[1] || providerMap);

  log("Fetching Morpho APYs...");
  const { apys: spotApys, avgApys } = await fetchMorphoApys(
    state.strategies.filter((s) => s.metaMorphoVaultAddress),
    { timeWindow: ousdConstraints.apyAverageWindow }
  );

  log("Fetching withdrawable liquidity...");
  const maxWithdrawals = await fetchMaxWithdrawals(
    state.strategies,
    providerMap
  );

  // Exclude strategies with suspiciously high APY (based on 6h average)
  const { active, excluded, warnings } = _filterExcludedStrategies(
    state.strategies,
    avgApys,
    ousdConstraints
  );

  // Discover deposit capacities (binary search for max deposit per strategy)
  log("Discovering deposit capacities...");
  const deployableCapital = _computeDeployableCapital(
    active,
    state.vaultBalance,
    state.shortfall,
    ousdConstraints
  );
  let depositCapacities = {};
  if (!process.env.IS_TEST) {
    depositCapacities = await discoverDepositCapacities(
      active,
      deployableCapital,
      ousdConstraints
    );
  }

  // Compute ideal allocation for active strategies (capacity-aware)
  // Uses 6h average APY for allocation decisions; spot APY for display/divergence guard
  const idealActive = computeIdealAllocation({
    strategies: active,
    apys: avgApys,
    spotApys,
    vaultBalance: state.vaultBalance,
    shortfall: state.shortfall,
    depositCapacities,
  });

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
    depositCapacities,
    warnings
  );
  const actions = sortActions(executableActions);

  printAllocationTable({
    actions,
    idealActions,
    vaultBalance: state.vaultBalance,
    shortfall: state.shortfall,
    warnings,
  });

  return { actions, idealActions, state, apys: avgApys, spotApys, warnings };
}

module.exports = {
  readOnChainState,
  fetchMaxWithdrawals,
  discoverDepositCapacities,
  computeIdealAllocation,
  buildExecutableActions,
  sortActions,
  fmtUsd,
  printAllocationTable,
  buildRebalancePlan,
  ousdMorphoStrategiesConfig,
  ousdConstraints,
  ACTION_DEPOSIT,
  ACTION_WITHDRAW,
  ACTION_NONE,
};
