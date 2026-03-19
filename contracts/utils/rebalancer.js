const { ethers, BigNumber } = require("ethers");
const { formatUnits } = require("ethers/lib/utils");

const addresses = require("./addresses");

const {
  ousdStrategiesConfig,
  ousdConstraints,
} = require("./rebalancer-config");

const log = require("./logger")("utils:rebalancer");

const USDC_DECIMALS = 6;

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

/**
 * Read on-chain state: strategy balances, vault idle USDC, withdrawal queue.
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
      // This will reserved the next time `addWithdrawalQueueLiquidity` is called
      availableVaultBalance = vaultBalance.sub(shortfall);
      shortfall = BigNumber.from(0);
    } else {
      // This will reserved the next time `addWithdrawalQueueLiquidity` is called
      availableVaultBalance = BigNumber.from(0);
      shortfall = shortfall.sub(vaultBalance);
    }
  }

  // Read the balances of the strategies
  const strategies = await Promise.all(
    ousdStrategiesConfig.map(async (cfg) => {
      const strategy = new ethers.Contract(cfg.address, strategyAbi, provider);

      const [balance, isTransferPending] = await Promise.all([
        strategy.checkBalance(addresses.mainnet.USDC),
        cfg.isCrossChain ? strategy.isTransferPending() : false,
      ]);

      return {
        name: cfg.name,
        address: cfg.address,
        morphoVaultAddress: cfg.morphoVaultAddress,
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
 * Fetch APY from Morpho GraphQL API for a list of vaults.
 * @param {Array} vaults - [{morphoVaultAddress, morphoChainId}]
 * @returns {object} map of morphoVaultAddress -> apy (float, e.g. 0.05 = 5%)
 */
async function fetchMorphoApys(vaults) {
  const results = {};

  for (const { morphoVaultAddress, morphoChainId } of vaults) {
    const query = `{
      vaultByAddress(address: "${morphoVaultAddress}", chainId: ${morphoChainId}) {
        state { netApy }
      }
    }`;

    try {
      const response = await fetch("https://api.morpho.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      const netApy = data?.data?.vaultByAddress?.state?.netApy;
      results[morphoVaultAddress] = netApy != null ? Number(netApy) : 0;
    } catch (e) {
      log(`Failed to fetch APY for ${morphoVaultAddress}: ${e.message}`);
      results[morphoVaultAddress] = 0;
    }
  }

  return results;
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
 * Greedy fill: sort strategies by APY descending, fill each up to maxPerStrategyBps.
 * Returns a plain object { [address]: BigNumber } of target balances.
 */
function _greedyFillByApy(
  strategies,
  deployableCapital,
  constraints,
  strategyApyOf
) {
  const sorted = [...strategies].sort(
    (a, b) => strategyApyOf(b) - strategyApyOf(a)
  );
  const maxPerStrategyAmt = deployableCapital
    .mul(constraints.maxPerStrategyBps)
    .div(10000);

  const targets = {};
  for (const s of strategies) targets[s.address] = BigNumber.from(0);

  let remaining = deployableCapital;
  for (const s of sorted) {
    const alloc = remaining.lt(maxPerStrategyAmt)
      ? remaining
      : maxPerStrategyAmt;
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
 * Ensure default strategy has at least minDefaultStrategyBps of deployable capital.
 * Claws back deficit from highest-allocated non-default strategies.
 */
function _enforceDefaultMinimum(
  targets,
  strategies,
  deployableCapital,
  constraints
) {
  const defaultStrategy = strategies.find((s) => s.isDefault);
  if (!defaultStrategy) return targets;

  const minAmt = deployableCapital
    .mul(constraints.minDefaultStrategyBps)
    .div(10000);
  const current = targets[defaultStrategy.address];
  if (current.gte(minAmt)) return targets;

  const deficit = minAmt.sub(current);
  targets[defaultStrategy.address] = minAmt;

  const sorted = [...strategies]
    .filter((s) => s.address !== defaultStrategy.address)
    .sort((a, b) => targets[b.address].sub(targets[a.address]));

  let toReduce = deficit;
  for (const s of sorted) {
    const available = targets[s.address];
    const take = available.lt(toReduce) ? available : toReduce;
    targets[s.address] = available.sub(take);
    toReduce = toReduce.sub(take);
    if (toReduce.isZero()) break;
  }

  return targets;
}

/**
 * Build an allocation row for a strategy given its computed target balance.
 */
function _buildAllocationRow(s, targetBalance, apy) {
  const delta = targetBalance.sub(s.balance);
  return {
    name: s.name,
    address: s.address,
    isCrossChain: s.isCrossChain,
    isTransferPending: s.isTransferPending,
    isDefault: s.isDefault,
    morphoVaultAddress: s.morphoVaultAddress,
    balance: s.balance,
    apy,
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
 * Allocation: sort strategies by APY descending, fill each up to maxPerStrategyBps.
 * Default strategy is guaranteed at least minDefaultStrategyBps.
 *
 * @param {object} params
 * @param {Array}  params.strategies
 * @param {object} params.apys - morphoVaultAddress -> apy (float)
 * @param {BigNumber} params.vaultBalance
 * @param {BigNumber} params.shortfall
 * @param {object} [params.constraints]
 * @returns {Array} allocation results
 */
function computeOptimalAllocation({
  strategies,
  apys,
  vaultBalance,
  shortfall,
  constraints: overrides = {},
}) {
  const constraints = { ...ousdConstraints, ...overrides };
  const strategyApyOf = (s) => apys[s.morphoVaultAddress] || 0;
  const deployableCapital = _computeDeployableCapital(
    strategies,
    vaultBalance,
    shortfall,
    constraints
  );

  if (deployableCapital.isZero()) {
    return strategies.map((s) =>
      _buildAllocationRow(s, BigNumber.from(0), strategyApyOf(s))
    );
  }

  const targets = _greedyFillByApy(
    strategies,
    deployableCapital,
    constraints,
    strategyApyOf
  );
  const adjusted = _enforceDefaultMinimum(
    targets,
    strategies,
    deployableCapital,
    constraints
  );
  return strategies.map((s) =>
    _buildAllocationRow(s, adjusted[s.address], strategyApyOf(s))
  );
}

/**
 * Highest APY across all strategies (used for APY spread check).
 */
function _computeMaxApy(allocations) {
  const apys = allocations
    .filter((a) => Number.isFinite(a.apy))
    .map((a) => a.apy);
  return apys.length > 0 ? Math.max(...apys) : 0;
}

/**
 * Filter withdrawals by feasibility: min move amount, cross-chain min, APY spread.
 * Infeasible withdrawals are set to ACTION_NONE with a reason.
 */
function _filterWithdrawals(result, constraints) {
  const maxApy = _computeMaxApy(result);
  const withdrawals = result.filter((a) => a.action === ACTION_WITHDRAW);

  for (const w of withdrawals) {
    const absDelta = w.delta.abs();
    if (absDelta.lt(constraints.minMoveAmount)) {
      w.action = ACTION_NONE;
      w.reason = "below min move";
    } else if (w.isCrossChain && absDelta.lt(constraints.crossChainMinAmount)) {
      w.action = ACTION_NONE;
      w.reason = "below cross-chain min";
    } else if (maxApy - w.apy < constraints.minApySpread) {
      w.action = ACTION_NONE;
      w.reason = "APY spread too small";
    }
  }

  return result;
}

/**
 * Compute deposit budget, then distribute across deposits in APY-descending order.
 * Budget = approved withdrawal total + vault surplus above reserves.
 * Infeasible deposits are set to ACTION_NONE with a reason.
 */
function _filterDeposits(result, vaultBalance, shortfall, constraints) {
  // Budget = approved withdrawals + vault surplus above reserves
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

  // Distribute to deposits in APY-descending order
  const deposits = result
    .filter((a) => a.action === ACTION_DEPOSIT)
    .sort((a, b) => b.apy - a.apy);

  for (const c of deposits) {
    if (c.isCrossChain && c.isTransferPending) {
      c.action = ACTION_NONE;
      c.reason = "transfer pending";
      continue;
    }
    if (budget.isZero()) {
      c.action = ACTION_NONE;
      c.reason = "insufficient vault funds";
      continue;
    }

    const amt = c.delta.gt(budget) ? budget : c.delta;
    budget = budget.sub(amt);

    if (amt.lt(constraints.minMoveAmount)) {
      c.action = ACTION_NONE;
      c.reason = "below min move";
      budget = budget.add(amt);
      continue;
    }
    if (c.isCrossChain && amt.lt(constraints.crossChainMinAmount)) {
      c.action = ACTION_NONE;
      c.reason = "below cross-chain min";
      budget = budget.add(amt);
      continue;
    }
    if (amt.lt(c.delta)) {
      c.delta = amt;
      c.targetBalance = c.balance.add(amt);
      c.reason = "trimmed to available vault funds";
    }
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
  // Try default (same-chain) strategy first
  const defaultStrategy = result.find((a) => a.isDefault);
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

  // Default couldn't cover — try lowest-APY cross-chain strategy
  const crossChainCandidates = result
    .filter(
      (a) => a.isCrossChain && a.balance.gt(constraints.crossChainMinAmount)
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
 * Vault surplus above reserves (shortfall + minVaultBalance).
 */
function _computeVaultSurplus(vaultBalance, shortfall, constraints) {
  const raw = vaultBalance
    .sub(shortfall)
    .sub(BigNumber.from(constraints.minVaultBalance));
  return raw.gt(0) ? raw : BigNumber.from(0);
}

/**
 * Deploy idle vault surplus to the default strategy.
 */
function _deploySurplus(result, surplus) {
  const defaultStrategy = result.find((a) => a.isDefault);
  if (!defaultStrategy) return result;

  defaultStrategy.delta = surplus;
  defaultStrategy.targetBalance = defaultStrategy.balance.add(surplus);
  defaultStrategy.action = ACTION_DEPOSIT;
  defaultStrategy.reason = "vault surplus fallback";
  return result;
}

/**
 * Filter allocations: withdraw pass → budget calculation → deposit pass → fallbacks.
 *
 * Pass A (withdrawals): filter overallocated strategies by feasibility.
 * Budget:              approved withdrawals + vault surplus = max depositable.
 * Pass B (deposits):   allocate from budget in APY-desc order, apply feasibility checks.
 * Pass 2 (fallbacks):  shortfall and surplus fallbacks run after both passes.
 *
 * @param {Array}     allocations - output of computeOptimalAllocation
 * @param {BigNumber} shortfall   - vault withdrawal shortfall (after addWithdrawalQueueLiquidity offset)
 * @param {BigNumber} vaultBalance - vault idle USDC (after addWithdrawalQueueLiquidity offset)
 * @param {object}    [constraintOverrides]
 * @returns {Array}
 */
function buildExecutableActions(
  allocations,
  shortfall = BigNumber.from(0),
  vaultBalance = BigNumber.from(0),
  constraintOverrides = {}
) {
  const constraints = { ...ousdConstraints, ...constraintOverrides };
  let result = allocations.map((a) => ({ ...a }));

  // 1. Filter withdrawals by feasibility (min move, cross-chain min, APY spread)
  result = _filterWithdrawals(result, constraints);

  // 2. Distribute available budget across deposits (highest APY first)
  result = _filterDeposits(result, vaultBalance, shortfall, constraints);

  // 3. Fallback: cover shortfall if no withdrawals were approved
  const hasApprovedWithdrawals = result.some(
    (a) => a.action === ACTION_WITHDRAW
  );
  if (!hasApprovedWithdrawals && shortfall.gt(0)) {
    result = _coverShortfall(result, shortfall, constraints);
  }

  // 4. Fallback: deploy vault surplus if no deposits were approved
  const hasApprovedDeposits = result.some((a) => a.action === ACTION_DEPOSIT);
  const surplus = _computeVaultSurplus(vaultBalance, shortfall, constraints);
  if (!hasApprovedDeposits && surplus.gt(0)) {
    result = _deploySurplus(result, surplus);
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
 * @param {Array}  params.optimalActions  - unfiltered allocations (output of computeOptimalAllocation)
 * @param {BigNumber} params.vaultBalance
 * @param {BigNumber} params.shortfall
 * @param {object} [params.constraints]
 */
function printAllocationTable({
  actions,
  optimalActions,
  vaultBalance,
  shortfall,
  constraints: overrides = {},
}) {
  const constraints = { ...ousdConstraints, ...overrides };

  // Use optimalActions for the table (shows optimal targets); fall back to feasible if absent
  const tableRows = optimalActions || actions;
  const totalCapital = tableRows.reduce(
    (sum, a) => sum.add(a.balance),
    vaultBalance
  );

  // Build a lookup map: address → feasible action (for the actions sections)
  const filteredByAddr = new Map(actions.map((a) => [a.address, a]));

  console.log("\n=== OUSD Rebalancer Status ===\n");
  console.log(`Total rebalancable capital : ${fmtUsd(totalCapital)} USDC`);
  console.log(`Withdrawal shortfall       : ${fmtUsd(shortfall)} USDC`);

  // ── Allocations table: shows optimal targets from optimalActions ────────────
  console.log("\n--- Allocations ---\n");
  const COL = { name: 22, amt: 22, delta: 18, apy: 8 };
  console.log(
    `${"Strategy".padEnd(COL.name)} ${"Current".padStart(
      COL.amt
    )} ${"Target (optimal)".padStart(COL.amt)} ${"Delta".padStart(
      COL.delta
    )} ${"APY".padStart(COL.apy)}`
  );
  console.log("-".repeat(COL.name + COL.amt * 2 + COL.delta + COL.apy + 4));

  const pct = (bn) =>
    totalCapital.gt(0)
      ? ` (${(Number(bn.mul(10000).div(totalCapital)) / 100).toFixed(1)}%)`
      : "";
  const sign = (bn) => (bn.gte(0) ? "+" : "-");

  for (const a of tableRows) {
    const apyStr = `${(a.apy * 100).toFixed(2)}%`;
    const tag = a.isDefault ? " *" : "";

    console.log(
      `${(a.name + tag).padEnd(COL.name)} ` +
        `${(fmtUsd(a.balance) + pct(a.balance)).padStart(
          COL.amt + pct(a.balance).length
        )} ` +
        `${(fmtUsd(a.targetBalance) + pct(a.targetBalance)).padStart(
          COL.amt + pct(a.targetBalance).length
        )} ` +
        `${(sign(a.delta) + fmtUsd(a.delta.abs())).padStart(COL.delta)} ` +
        `${apyStr.padStart(COL.apy)}`
    );
  }

  // Vault (idle) row
  const vaultTarget = shortfall.add(
    BigNumber.from(constraints.minVaultBalance)
  );
  const vaultDelta = vaultTarget.sub(vaultBalance);
  const vaultDeltaSign = sign(vaultDelta);

  console.log(
    `${"Vault (idle)".padEnd(COL.name)} ` +
      `${(fmtUsd(vaultBalance) + pct(vaultBalance)).padStart(
        COL.amt + pct(vaultBalance).length
      )} ` +
      `${(fmtUsd(vaultTarget) + pct(vaultTarget)).padStart(
        COL.amt + pct(vaultTarget).length
      )} ` +
      `${(vaultDeltaSign + fmtUsd(vaultDelta.abs())).padStart(COL.delta)} ` +
      `${"—".padStart(COL.apy)}`
  );

  console.log("-".repeat(COL.name + COL.amt * 2 + COL.delta + COL.apy + 4));
  console.log(
    `${"Total".padEnd(COL.name)} ${fmtUsd(totalCapital).padStart(COL.amt)}`
  );
  console.log("  * = default strategy\n");

  // ── Section 1: All optimal allocation changes ──────────────────────────────
  const rawChanges = (optimalActions || actions).filter(
    (a) => !a.delta.isZero()
  );

  console.log("--- Actions for Optimal Allocation ---\n");
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
}

/**
 * Main entry: read state, fetch APYs, compute allocations, print table.
 */
async function buildRebalancePlan(provider) {
  log("Reading on-chain state...");
  const state = await readOnChainState(provider);

  log("Fetching Morpho APYs...");
  const apys = await fetchMorphoApys(
    state.strategies
      .filter((s) => s.morphoVaultAddress)
      .map((s) => ({
        morphoVaultAddress: s.morphoVaultAddress,
        morphoChainId: s.morphoChainId,
      }))
  );

  const optimalActions = computeOptimalAllocation({
    strategies: state.strategies,
    apys,
    vaultBalance: state.vaultBalance,
    shortfall: state.shortfall,
  });

  const executableActions = buildExecutableActions(
    optimalActions,
    state.shortfall,
    state.vaultBalance
  );
  const actions = sortActions(executableActions);

  printAllocationTable({
    actions,
    optimalActions,
    vaultBalance: state.vaultBalance,
    shortfall: state.shortfall,
  });

  return { actions, optimalActions, state, apys };
}

module.exports = {
  readOnChainState,
  fetchMorphoApys,
  computeOptimalAllocation,
  buildExecutableActions,
  sortActions,
  fmtUsd,
  printAllocationTable,
  buildRebalancePlan,
  ousdStrategiesConfig,
  ousdConstraints,
  ACTION_DEPOSIT,
  ACTION_WITHDRAW,
  ACTION_NONE,
};
