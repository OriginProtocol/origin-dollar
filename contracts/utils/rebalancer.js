const { ethers, BigNumber } = require("ethers");
const { formatUnits } = require("ethers/lib/utils");

const addresses = require("./addresses");

const {
  ousdMorphoStrategiesConfig,
  ousdConstraints,
} = require("./rebalancer-config");
const { estimateVaultApy, estimateDepositImpact } = require("./morpho-apy");

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
 * Fetch a single vault's current net APY after fees from the Morpho GraphQL API.
 * The APY is a weighted average based on the liquidity allocated in each market.
 * Returns a numeric APY (e.g. 0.05 = 5%) or 0 on failure.
 */
async function _fetchMorphoVaultApy(metaMorphoVaultAddress, morphoChainId) {
  const query = `{
    vaultByAddress(address: "${metaMorphoVaultAddress}", chainId: ${morphoChainId}) {
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
    return netApy != null ? Number(netApy) : 0;
  } catch (e) {
    log(`Failed to fetch APY for ${metaMorphoVaultAddress}: ${e.message}`);
    return 0;
  }
}

/**
 * Fetch APYs for multiple vaults in parallel.
 * Returns both on-chain (authoritative) and GraphQL (display-only) APYs.
 *
 * @param {Array} vaults - objects with metaMorphoVaultAddress and morphoChainId
 * @param {object} providers - { [chainId]: ethersProvider }
 * @returns {object} { apys: { addr: number }, graphqlApys: { addr: number } }
 */
async function fetchMorphoApys(vaults, providers) {
  const entries = await Promise.all(
    vaults.map(async (v) => {
      const provider = providers[v.morphoChainId];

      // Fetch on-chain and GraphQL APYs in parallel
      const onChainApyPromise = provider
        ? estimateVaultApy(
            provider,
            v.morphoChainId,
            v.metaMorphoVaultAddress
          ).catch((err) => {
            console.error(
              `[rebalancer] On-chain APY failed for ${v.metaMorphoVaultAddress} ` +
                `on chain ${v.morphoChainId}: ${err.message}`
            );
            return 0;
          })
        : Promise.resolve(0);

      const [onChainApy, graphqlApy] = await Promise.all([
        onChainApyPromise,
        _fetchMorphoVaultApy(v.metaMorphoVaultAddress, v.morphoChainId),
      ]);

      return {
        addr: v.metaMorphoVaultAddress,
        onChainApy,
        graphqlApy,
      };
    })
  );

  const apys = {};
  const graphqlApys = {};
  for (const { addr, onChainApy, graphqlApy } of entries) {
    apys[addr] = onChainApy;
    graphqlApys[addr] = graphqlApy;
  }
  return { apys, graphqlApys };
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
    .sort((a, b) => (targets[b.address].gt(targets[a.address]) ? 1 : -1));

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
function _buildAllocationRow(s, targetBalance, apy, graphqlApy = 0) {
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
    graphqlApy,
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
 * @param {object} params.apys - metaMorphoVaultAddress -> apy (float, on-chain)
 * @param {object} [params.graphqlApys] - metaMorphoVaultAddress -> apy (float, GraphQL display-only)
 * @param {BigNumber} params.vaultBalance
 * @param {BigNumber} params.shortfall
 * @param {object} [params.constraints]
 * @returns {Array} allocation results
 */
function computeIdealAllocation({
  strategies,
  apys,
  graphqlApys = {},
  vaultBalance,
  shortfall,
  constraints: overrides = {},
}) {
  const constraints = { ...ousdConstraints, ...overrides };
  const strategyApyOf = (s) => apys[s.metaMorphoVaultAddress] || 0;
  const strategyGraphqlApyOf = (s) =>
    graphqlApys[s.metaMorphoVaultAddress] || 0;
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
        strategyGraphqlApyOf(s)
      )
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
    _buildAllocationRow(
      s,
      adjusted[s.address],
      strategyApyOf(s),
      strategyGraphqlApyOf(s)
    )
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
 * Vault surplus above reserves (shortfall + minVaultBalance).
 */
function _computeVaultSurplus(vaultBalance, shortfall, constraints) {
  const raw = vaultBalance
    .sub(shortfall)
    .sub(BigNumber.from(constraints.minVaultBalance));
  return raw.gt(0) ? raw : BigNumber.from(0);
}

/**
 * Filter withdrawals by feasibility: min move amount, cross-chain min, APY spread.
 * Infeasible withdrawals are set to ACTION_NONE with a reason.
 */
function _filterWithdrawals(result, constraints) {
  const maxApy = _computeMaxApy(result);
  const withdrawals = result.filter((a) => a.action === ACTION_WITHDRAW);

  for (const w of withdrawals) {
    let amt = w.delta.abs();

    // Cap to available liquidity first so subsequent size checks use the capped amount
    if (w.withdrawableLiquidity !== null) {
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
 *
 * @param {object} [providers] - { [chainId]: ethersProvider } for APY impact checks.
 *   Skipped when process.env.IS_TEST is set.
 */
async function _filterDeposits(
  result,
  vaultBalance,
  shortfall,
  constraints,
  providers = {}
) {
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

  for (const deposit of deposits) {
    if (deposit.isCrossChain && deposit.isTransferPending) {
      deposit.action = ACTION_NONE;
      deposit.reason = "transfer pending";
      continue;
    }
    if (budget.isZero()) {
      deposit.action = ACTION_NONE;
      deposit.reason = "insufficient vault funds";
      continue;
    }

    const amt = deposit.delta.gt(budget) ? budget : deposit.delta;

    if (amt.lt(constraints.minMoveAmount)) {
      deposit.action = ACTION_NONE;
      deposit.reason = "below min move";
      continue;
    }
    if (deposit.isCrossChain && amt.lt(constraints.crossChainMinAmount)) {
      deposit.action = ACTION_NONE;
      deposit.reason = "below cross-chain min";
      continue;
    }
    if (amt.lt(deposit.delta)) {
      deposit.delta = amt;
      deposit.targetBalance = deposit.balance.add(amt);
      deposit.reason = "trimmed to available vault funds";
    }

    // APY impact check: skip if deposit would drop vault APY by more than maxApyImpactBps.
    // Skipped in unit tests (IS_TEST=true) since it requires live provider calls.
    if (
      !process.env.IS_TEST &&
      constraints.maxApyImpactBps &&
      deposit.metaMorphoVaultAddress &&
      deposit.morphoChainId
    ) {
      const provider = providers[deposit.morphoChainId];
      if (provider) {
        try {
          const { impactBps } = await estimateDepositImpact(
            provider,
            deposit.morphoChainId,
            deposit.metaMorphoVaultAddress,
            amt
          );
          if (impactBps > constraints.maxApyImpactBps) {
            deposit.action = ACTION_NONE;
            deposit.reason = `APY impact ${impactBps}bps > max ${constraints.maxApyImpactBps}bps`;
            continue;
          }
        } catch (err) {
          log(`APY impact check failed for ${deposit.name}: ${err.message}`);
        }
      }
    }

    budget = budget.sub(amt);
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
 * Deploy idle vault surplus to the default strategy.
 */
function _deploySurplus(result, surplus) {
  const defaultStrategy = result.find(
    (a) => a.isDefault && a.reason !== "APY exceeds threshold"
  );
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
 * @param {Array}     allocations - output of computeIdealAllocation
 * @param {BigNumber} shortfall   - vault withdrawal shortfall (after addWithdrawalQueueLiquidity offset)
 * @param {BigNumber} vaultBalance - vault idle USDC (after addWithdrawalQueueLiquidity offset)
 * @param {object}    [constraintOverrides]
 * @param {object}    [providers] - { [chainId]: ethersProvider } forwarded to _filterDeposits
 * @returns {Promise<Array>}
 */
async function buildExecutableActions(
  allocations,
  shortfall = BigNumber.from(0),
  vaultBalance = BigNumber.from(0),
  constraintOverrides = {},
  providers = {}
) {
  const constraints = { ...ousdConstraints, ...constraintOverrides };
  let result = allocations.map((a) => ({ ...a }));

  // 1. Filter withdrawals by feasibility (min move, cross-chain min, APY spread)
  result = _filterWithdrawals(result, constraints);

  // 2. Distribute available budget across deposits (highest APY first)
  result = await _filterDeposits(
    result,
    vaultBalance,
    shortfall,
    constraints,
    providers
  );

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
    const apyStr = a.graphqlApy
      ? `${(a.apy * 100).toFixed(2)}% (API: ${(a.graphqlApy * 100).toFixed(2)}%)`
      : `${(a.apy * 100).toFixed(2)}%`;
    return {
      name: `${a.name}${a.isDefault ? " *" : ""}`,
      current: `${fmtUsd(a.balance)}${pct(a.balance)}`,
      avail:
        a.withdrawableLiquidity !== null
          ? fmtUsd(a.withdrawableLiquidity)
          : "n/a",
      target: `${fmtUsd(recTarget)}${pct(recTarget)}`,
      delta: `${sign(recDelta)}${fmtUsd(recDelta.abs())}`,
      apy: apyStr,
    };
  });
  const vaultRow = {
    name: "Vault (idle)",
    current: `${fmtUsd(vaultBalance)}${pct(vaultBalance)}`,
    avail: "—",
    target: `${fmtUsd(vaultTarget)}${pct(vaultTarget)}`,
    delta: `${vaultDeltaSign}${fmtUsd(vaultDelta.abs())}`,
    apy: "—",
  };
  const allRows = [...formattedRows, vaultRow];
  const COL = {
    name: Math.max("Strategy".length, ...allRows.map((row) => row.name.length)),
    current: Math.max(
      "Current".length,
      ...allRows.map((row) => row.current.length)
    ),
    avail: Math.max(
      "Avail.".length,
      ...allRows.map((row) => row.avail.length)
    ),
    target: Math.max(
      "Target (rec.)".length,
      ...allRows.map((row) => row.target.length)
    ),
    delta: Math.max("Delta".length, ...allRows.map((row) => row.delta.length)),
    apy: Math.max("APY".length, ...allRows.map((row) => row.apy.length)),
  };

  console.log(
    `${"Strategy".padEnd(COL.name)}${COL_SEP}${"Current".padStart(
      COL.current
    )}${COL_SEP}${"Avail.".padStart(COL.avail)}${COL_SEP}${"Target (rec.)".padStart(
      COL.target
    )}${COL_SEP}${"Delta".padStart(COL.delta)}${COL_SEP}${"APY".padStart(
      COL.apy
    )}`
  );
  console.log(
    "-".repeat(
      COL.name +
        COL.current +
        COL.avail +
        COL.target +
        COL.delta +
        COL.apy +
        COL_SEP.length * 5
    )
  );

  for (const row of formattedRows) {
    console.log(
      `${row.name.padEnd(COL.name)}${COL_SEP}` +
        `${row.current.padStart(COL.current)}${COL_SEP}` +
        `${row.avail.padStart(COL.avail)}${COL_SEP}` +
        `${row.target.padStart(COL.target)}${COL_SEP}` +
        `${row.delta.padStart(COL.delta)}${COL_SEP}` +
        `${row.apy.padStart(COL.apy)}`
    );
  }

  console.log(
    `${vaultRow.name.padEnd(COL.name)}${COL_SEP}` +
      `${vaultRow.current.padStart(COL.current)}${COL_SEP}` +
      `${vaultRow.avail.padStart(COL.avail)}${COL_SEP}` +
      `${vaultRow.target.padStart(COL.target)}${COL_SEP}` +
      `${vaultRow.delta.padStart(COL.delta)}${COL_SEP}` +
      `${vaultRow.apy.padStart(COL.apy)}`
  );

  console.log(
    "-".repeat(
      COL.name +
        COL.current +
        COL.avail +
        COL.target +
        COL.delta +
        COL.apy +
        COL_SEP.length * 5
    )
  );
  console.log(
    `${"Total".padEnd(COL.name)}${COL_SEP}${fmtUsd(totalCapital).padStart(
      COL.current
    )}`
  );
  console.log("  * = default strategy\n");

  // ── Section 1: All ideal allocation changes ──────────────────────────────
  const rawChanges = tableRows.filter((a) => !a.delta.isZero());

  console.log("--- Actions for Ideal Allocation ---\n");
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
 * - Cross-chain: the master and remote strategy share the same address (CREATE2 deployment).
 *   Use the remote-chain provider, call remoteStrategy.platformAddress() to get the Morpho
 *   V2 vault address, then call vault.maxWithdraw(strategyAddress) (ERC-4626).
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
          // Master and remote strategy share the same address via CREATE2
          const provider = providers[s.morphoChainId];
          if (!provider) return;
          const remoteStrategy = new ethers.Contract(
            s.address,
            platformAddressAbi,
            provider
          );
          const vaultAddress = await remoteStrategy.platformAddress();
          const vault = new ethers.Contract(
            vaultAddress,
            erc4626MaxWithdrawAbi,
            provider
          );
          results[s.address] = await vault.maxWithdraw(s.address);
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

  log("Fetching Morpho APYs (on-chain + GraphQL)...");
  const { apys, graphqlApys } = await fetchMorphoApys(
    state.strategies.filter((s) => s.metaMorphoVaultAddress),
    providerMap
  );

  log("Fetching withdrawable liquidity...");
  const maxWithdrawals = await fetchMaxWithdrawals(
    state.strategies,
    providerMap
  );

  // Exclude strategies with suspiciously high APY
  const { active, excluded, warnings } = _filterExcludedStrategies(
    state.strategies,
    apys,
    ousdConstraints
  );

  // Compute ideal (unconstrained) allocation for active strategies only
  const idealActive = computeIdealAllocation({
    strategies: active,
    apys,
    graphqlApys,
    vaultBalance: state.vaultBalance,
    shortfall: state.shortfall,
  });

  // Build frozen rows for excluded strategies
  const idealExcluded = excluded.map((s) => {
    const row = _buildAllocationRow(
      s,
      s.balance,
      apys[s.metaMorphoVaultAddress] || 0,
      graphqlApys[s.metaMorphoVaultAddress] || 0
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
    providerMap
  );
  const actions = sortActions(executableActions);

  printAllocationTable({
    actions,
    idealActions,
    vaultBalance: state.vaultBalance,
    shortfall: state.shortfall,
    warnings,
  });

  return { actions, idealActions, state, apys, graphqlApys, warnings };
}

module.exports = {
  readOnChainState,
  fetchMorphoApys,
  fetchMaxWithdrawals,
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
