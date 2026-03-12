const { BigNumber } = require("ethers");
const { formatUnits } = require("ethers/lib/utils");

const addresses = require("./addresses");

const log = require("./logger")("utils:rebalancer");

const USDC_DECIMALS = 6;

// Human-readable ABIs for contracts we interact with
const vaultAbi = [
  "function withdrawalQueueMetadata() external view returns (tuple(uint128 queued, uint128 claimable, uint128 claimed, uint128 nextWithdrawalIndex))",
  "function totalValue() external view returns (uint256)",
];

const strategyAbi = [
  "function checkBalance(address _asset) external view returns (uint256)",
  // This exists only on CrossChain strategies
  "function isTransferPending() external view returns (bool)",
];

const erc20Abi = [
  "function balanceOf(address account) external view returns (uint256)",
];

// Strategy config for OUSD
const strategiesConfig = [
  {
    name: "Ethereum Morpho",
    address: addresses.mainnet.MorphoOUSDv2StrategyProxy,
    // Morpho V1 vault address for APY lookup (the V2 wrapper is not in Morpho's API)
    morphoVaultAddress: addresses.mainnet.MorphoOUSDv1Vault,
    morphoChainId: 1,
    isCrossChain: false,
    isDefault: true,
  },
  {
    name: "Base Morpho",
    address: addresses.mainnet.CrossChainMasterStrategy,
    // Morpho V1 vault on Base for APY lookup
    morphoVaultAddress: "0x581Cc9a73Ec7431723A4a80699B8f801205841F1",
    morphoChainId: 8453,
    isCrossChain: true,
    isDefault: false,
  },
  {
    name: "Curve AMO",
    address: addresses.mainnet.CurveOUSDAMOStrategy,
    morphoVaultAddress: null,
    morphoChainId: null,
    isCrossChain: false,
    isAmo: true,
  },
];

// Default constraints
const defaultConstraints = {
  minDefaultStrategyBps: 2000, // Default strategy always gets ≥ 20% of deployable
  maxPerChainBps: 7000, // No single chain gets > 70%
  minMoveAmount: 5_000_000_000, // $5K in USDC (6 decimals)
  crossChainMinAmount: 25_000_000_000, // $25K in USDC (6 decimals)
  minVaultBalance: 3_000_000_000, // $3K in USDC (6 decimals)
  minApySpread: 0.005, // 0.5% minimum APY spread to trigger rebalancing
};

/**
 * Read on-chain state: strategy balances, vault idle USDC, withdrawal queue.
 * @param {object} provider - ethers provider
 * @returns {object} { strategies, vaultBalance, shortfall, totalValue }
 */
async function readOnChainState(provider) {
  const vault = new ethers.Contract(
    addresses.mainnet.VaultProxy,
    vaultAbi,
    provider
  );
  const usdc = new ethers.Contract(addresses.mainnet.USDC, erc20Abi, provider);

  const [queueMeta, vaultBalance, totalValue] = await Promise.all([
    vault.withdrawalQueueMetadata(),
    usdc.balanceOf(addresses.mainnet.VaultProxy),
    vault.totalValue(),
  ]);

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

  const strategies = await Promise.all(
    strategiesConfig.map(async (cfg) => {
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
        isAmo: cfg.isAmo || false,
        balance,
        isTransferPending,
      };
    })
  );

  return {
    strategies,
    vaultBalance: availableVaultBalance,
    shortfall,
    totalValue,
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
 * Pure computation: given balances and APYs, compute target allocations.
 *
 * Total capital = sum(rebalancableBalances) + vaultBalance - shortfall - minVaultBalance
 * Shortfall + minVaultBalance are pre-reserved for the vault, excluded from the allocation pie.
 *
 * Allocation: sort strategies by APY descending, fill each up to maxPerChainBps.
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
function computeAllocation({
  strategies,
  apys,
  vaultBalance,
  shortfall,
  constraints: overrides = {},
}) {
  const constraints = { ...defaultConstraints, ...overrides };

  const amoStrategies = strategies.filter((s) => s.isAmo);
  const rebalancable = strategies.filter((s) => !s.isAmo);

  const amoResults = amoStrategies.map((s) => ({
    name: s.name,
    address: s.address,
    isCrossChain: s.isCrossChain,
    isTransferPending: s.isTransferPending,
    isDefault: false,
    isAmo: true,
    morphoVaultAddress: s.morphoVaultAddress,
    balance: s.balance,
    apy: 0,
    targetBalance: BigNumber.from(0),
    delta: BigNumber.from(0),
    action: "none",
    reason: "AMO - not rebalanced",
  }));

  // Deployable capital = everything minus what the vault must keep
  const totalRebalancable = rebalancable.reduce(
    (sum, s) => sum.add(s.balance),
    vaultBalance
  );
  // Always prioritize the shortfall and minVaultBalance
  const reserved = shortfall.add(BigNumber.from(constraints.minVaultBalance));
  const deployableCapital = totalRebalancable.gt(reserved)
    ? totalRebalancable.sub(reserved)
    : BigNumber.from(0);

  if (deployableCapital.isZero()) {
    return [
      ...rebalancable.map((s) => ({
        name: s.name,
        address: s.address,
        isCrossChain: s.isCrossChain,
        isTransferPending: s.isTransferPending,
        isDefault: s.isDefault,
        isAmo: false,
        morphoVaultAddress: s.morphoVaultAddress,
        balance: s.balance,
        apy: apys[s.morphoVaultAddress] || 0,
        targetBalance: BigNumber.from(0),
        delta: s.balance.mul(-1),
        action: s.balance.gt(0) ? "withdraw" : "none",
      })),
      ...amoResults,
    ];
  }

  // Sort by APY descending (highest APY strategy gets filled first)
  const strategyApyOf = (s) => apys[s.morphoVaultAddress] || 0;
  const sorted = [...rebalancable].sort(
    (a, b) => strategyApyOf(b) - strategyApyOf(a)
  );

  const maxPerChainAmt = deployableCapital
    .mul(constraints.maxPerChainBps)
    .div(10000);

  // Greedy fill: highest APY gets up to maxPerChainBps, then next, etc.
  const targets = new Map(
    rebalancable.map((s) => [s.address, BigNumber.from(0)])
  );
  let remaining = deployableCapital;

  for (const s of sorted) {
    const alloc = remaining.lt(maxPerChainAmt) ? remaining : maxPerChainAmt;
    targets.set(s.address, alloc);
    remaining = remaining.sub(alloc);
    if (remaining.isZero()) break;
  }

  // Any dust from rounding goes to the default strategy
  if (remaining.gt(0)) {
    const def = rebalancable.find((s) => s.isDefault);
    if (def) targets.set(def.address, targets.get(def.address).add(remaining));
  }

  // Enforce minimum for default strategy
  const defaultStrategy = rebalancable.find((s) => s.isDefault);
  if (defaultStrategy) {
    const minAmt = deployableCapital
      .mul(constraints.minDefaultStrategyBps)
      .div(10000);
    const current = targets.get(defaultStrategy.address);
    if (current.lt(minAmt)) {
      const deficit = minAmt.sub(current);
      targets.set(defaultStrategy.address, minAmt);
      // Claw back deficit from the highest-allocated non-default strategies
      let toReduce = deficit;
      for (const s of sorted) {
        if (s.address === defaultStrategy.address) continue;
        const available = targets.get(s.address);
        const take = available.lt(toReduce) ? available : toReduce;
        targets.set(s.address, available.sub(take));
        toReduce = toReduce.sub(take);
        if (toReduce.isZero()) break;
      }
    }
  }

  const results = rebalancable.map((s) => {
    const targetBalance = targets.get(s.address);
    const delta = targetBalance.sub(s.balance);
    let action = "none";
    if (delta.gt(0)) action = "deposit";
    else if (delta.lt(0)) action = "withdraw";

    return {
      name: s.name,
      address: s.address,
      isCrossChain: s.isCrossChain,
      isTransferPending: s.isTransferPending,
      isDefault: s.isDefault,
      isAmo: false,
      morphoVaultAddress: s.morphoVaultAddress,
      balance: s.balance,
      apy: strategyApyOf(s),
      targetBalance,
      delta,
      action,
    };
  });

  return [...results, ...amoResults];
}

/**
 * Filter allocations: withdraw pass → budget calculation → deposit pass → fallbacks.
 *
 * Pass A (withdrawals): filter overallocated strategies by feasibility.
 * Budget:              approved withdrawals + vault surplus = max depositable.
 * Pass B (deposits):   allocate from budget in APY-desc order, apply feasibility checks.
 * Pass 2 (fallbacks):  shortfall and surplus fallbacks run after both passes.
 *
 * @param {Array}     allocations - output of computeAllocation
 * @param {BigNumber} shortfall   - vault withdrawal shortfall (after addWithdrawalQueueLiquidity offset)
 * @param {BigNumber} vaultBalance - vault idle USDC (after addWithdrawalQueueLiquidity offset)
 * @param {object}    [constraintOverrides]
 * @returns {Array}
 */
function filterActions(
  allocations,
  shortfall = BigNumber.from(0),
  vaultBalance = BigNumber.from(0),
  constraintOverrides = {}
) {
  const constraints = { ...defaultConstraints, ...constraintOverrides };
  const minVaultBalance = BigNumber.from(constraints.minVaultBalance);

  // Highest APY across all rebalancable strategies (used for APY spread check)
  const validApys = allocations
    .filter((a) => !a.isAmo && Number.isFinite(a.apy))
    .map((a) => a.apy);
  const maxApy = validApys.length > 0 ? Math.max(...validApys) : 0;

  // --- Pass A: filter withdrawals ---
  const filtered = allocations.map((a) => {
    if (a.isAmo || a.action !== "withdraw") return a;

    const absDelta = a.delta.abs();
    if (absDelta.lt(constraints.minMoveAmount)) {
      return { ...a, action: "none", reason: "below min move" };
    }
    if (a.isCrossChain && absDelta.lt(constraints.crossChainMinAmount)) {
      return { ...a, action: "none", reason: "below cross-chain min" };
    }
    if (maxApy - a.apy < constraints.minApySpread) {
      return { ...a, action: "none", reason: "APY spread too small" };
    }
    return a;
  });

  // --- Budget: approved withdrawals + vault surplus ---
  const approvedWithdrawTotal = filtered
    .filter((a) => !a.isAmo && a.action === "withdraw")
    .reduce((sum, a) => sum.add(a.delta.abs()), BigNumber.from(0));
  const rawSurplus = vaultBalance.sub(shortfall).sub(minVaultBalance);
  const vaultSurplus = rawSurplus.gt(0) ? rawSurplus : BigNumber.from(0);
  let depositBudget = approvedWithdrawTotal.add(vaultSurplus);

  // --- Pass B: filter deposits, greedily allocate from budget (highest APY first) ---
  const depositCandidates = filtered
    .filter((a) => !a.isAmo && a.action === "deposit")
    .sort((a, b) => b.apy - a.apy);

  for (const candidate of depositCandidates) {
    const idx = filtered.findIndex((a) => a.address === candidate.address);

    // Cross-chain transfer already in flight → skip, don't consume budget
    if (candidate.isCrossChain && candidate.isTransferPending) {
      filtered[idx] = {
        ...candidate,
        action: "none",
        reason: "transfer pending",
      };
      continue;
    }

    if (depositBudget.isZero()) {
      filtered[idx] = {
        ...candidate,
        action: "none",
        reason: "insufficient vault funds",
      };
      continue;
    }

    const depositAmt = candidate.delta.gt(depositBudget)
      ? depositBudget
      : candidate.delta;
    depositBudget = depositBudget.sub(depositAmt);

    if (depositAmt.lt(constraints.minMoveAmount)) {
      filtered[idx] = {
        ...candidate,
        action: "none",
        reason: "below min move",
      };
      depositBudget = depositBudget.add(depositAmt); // restore — money stays in vault
      continue;
    }
    if (
      candidate.isCrossChain &&
      depositAmt.lt(constraints.crossChainMinAmount)
    ) {
      filtered[idx] = {
        ...candidate,
        action: "none",
        reason: "below cross-chain min",
      };
      depositBudget = depositBudget.add(depositAmt); // restore
      continue;
    }
    if (depositAmt.lt(candidate.delta)) {
      // Trimmed to available budget — update delta and targetBalance
      filtered[idx] = {
        ...candidate,
        delta: depositAmt,
        targetBalance: candidate.balance.add(depositAmt),
        reason: "trimmed to available vault funds",
      };
    }
    // else: full amount fits — no change needed
  }

  // --- Pass 2: fallback if no withdraw was approved but shortfall exists ---
  const hasWithdraw = filtered.some((a) => !a.isAmo && a.action === "withdraw");
  if (!hasWithdraw && shortfall.gt(0)) {
    const defaultA = filtered.find((a) => a.isDefault);
    let coveredByDefault = false;

    if (defaultA && defaultA.balance.gt(0)) {
      const originalDelta = defaultA.delta; // from computeAllocation, unchanged by Pass 1
      const isOverallocated = originalDelta.lt(0);

      let withdrawAmt = null;

      if (isOverallocated) {
        // Withdraw max(rebalanceDelta, shortfall), capped at balance
        const overAmt = originalDelta.abs();
        const effectiveAmt = overAmt.gt(shortfall) ? overAmt : shortfall;
        withdrawAmt = defaultA.balance.lt(effectiveAmt)
          ? defaultA.balance
          : effectiveAmt;
      } else {
        // Underallocated or at target: only fund if conditions are met
        if (shortfall.lt(constraints.crossChainMinAmount)) {
          // Small shortfall: always try, even if balance < shortfall
          withdrawAmt = defaultA.balance.lt(shortfall)
            ? defaultA.balance
            : shortfall;
        } else if (defaultA.balance.gte(shortfall)) {
          // Large shortfall and default has enough
          withdrawAmt = shortfall;
        }
        // else: large shortfall + insufficient balance → skip this round
      }

      if (withdrawAmt && withdrawAmt.gt(0)) {
        const idx = filtered.indexOf(defaultA);
        filtered[idx] = {
          ...defaultA,
          delta: withdrawAmt.mul(-1),
          targetBalance: defaultA.balance.sub(withdrawAmt),
          action: "withdraw",
          reason: "shortfall fallback",
        };
        coveredByDefault = true;
      }
    }

    // If default couldn't cover, try lowest-APY cross-chain strategy
    if (!coveredByDefault) {
      const crossChain = filtered
        .filter(
          (a) =>
            !a.isAmo &&
            a.isCrossChain &&
            a.balance.gt(constraints.crossChainMinAmount)
        )
        .sort((a, b) => a.apy - b.apy);

      if (crossChain.length > 0) {
        const s = crossChain[0];
        const withdrawAmt = s.balance.lt(shortfall) ? s.balance : shortfall;
        const idx = filtered.indexOf(s);
        filtered[idx] = {
          ...s,
          delta: withdrawAmt.mul(-1),
          targetBalance: s.balance.sub(withdrawAmt),
          action: "withdraw",
          reason: "shortfall fallback (cross-chain)",
        };
      }
    }
  }

  // --- Pass 2: fallback if no deposit was approved but vault has surplus ---
  const hasDeposit = filtered.some((a) => !a.isAmo && a.action === "deposit");
  const surplus = vaultBalance.sub(shortfall).sub(minVaultBalance);
  if (!hasDeposit && surplus.gt(0)) {
    const defaultA = filtered.find((a) => a.isDefault);
    if (defaultA) {
      const idx = filtered.indexOf(defaultA);
      filtered[idx] = {
        ...defaultA,
        delta: surplus,
        targetBalance: defaultA.balance.add(surplus),
        action: "deposit",
        reason: "vault surplus fallback",
      };
    }
  }

  return filtered;
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
    if (a.action === "withdraw" && a.reason && a.reason.includes("shortfall"))
      return 0;
    if (a.action === "withdraw") return 1;
    if (a.action === "deposit") return 2;
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
 * @param {Array}  params.allocations    - filtered+sorted allocations (output of sortActions)
 * @param {Array}  params.rawAllocations - unfiltered allocations (output of computeAllocation)
 * @param {BigNumber} params.vaultBalance
 * @param {BigNumber} params.shortfall
 * @param {BigNumber} params.totalValue
 * @param {object} [params.constraints]
 */
function printAllocationTable({
  allocations,
  rawAllocations,
  vaultBalance,
  shortfall,
  totalValue,
  constraints: overrides = {},
}) {
  const constraints = { ...defaultConstraints, ...overrides };

  // Use rawAllocations for the table (shows optimal targets); fall back to filtered if absent
  const tableRows = (rawAllocations || allocations).filter((a) => !a.isAmo);
  const totalCapital = tableRows.reduce(
    (sum, a) => sum.add(a.balance),
    vaultBalance
  );
  const amoBalance = (rawAllocations || allocations)
    .filter((a) => a.isAmo)
    .reduce((sum, a) => sum.add(a.balance), BigNumber.from(0));

  // Build a lookup map: address → filtered allocation (for the actions sections)
  const filteredByAddr = new Map(allocations.map((a) => [a.address, a]));

  // Format an 18-decimal BigNumber (OUSD) with commas and 2 decimal places
  const fmtOusd = (bn) => {
    const n = parseFloat(formatUnits(bn, 18));
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  console.log("\n=== OUSD Rebalancer Status ===\n");
  console.log(`Total vault value    : ${fmtOusd(totalValue)} OUSD`);
  console.log(`  (excl. Curve AMO)  : ${fmtUsd(totalCapital)} USDC`);
  console.log(`  Curve AMO balance  : ${fmtUsd(amoBalance)} USDC`);
  console.log(`Withdrawal shortfall : ${fmtUsd(shortfall)} USDC`);

  // ── Allocations table: shows optimal targets from rawAllocations ────────────
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
  const rawChanges = (rawAllocations || allocations).filter(
    (a) => !a.isAmo && !a.delta.isZero()
  );

  console.log("--- Actions for Optimal Allocation ---\n");
  if (rawChanges.length === 0) {
    console.log("  All strategies at target.\n");
  } else {
    for (const raw of rawChanges) {
      const verb = raw.delta.lt(0) ? "WITHDRAW" : "DEPOSIT";
      const dir = raw.delta.lt(0) ? "from" : "to  ";
      const filtered = filteredByAddr.get(raw.address);
      const isApproved = filtered && filtered.action !== "none";
      const wasTrimmed = isApproved && filtered.delta.abs().lt(raw.delta.abs());

      let suffix = "";
      if (!isApproved && filtered?.reason) {
        suffix = ` [Not recommeneded: ${filtered.reason}]`;
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
  const actionRows = allocations.filter((a) => !a.isAmo && a.action !== "none");

  console.log("--- Recommended Actions ---\n");
  if (actionRows.length === 0) {
    console.log("  No actions required.\n");
  } else {
    for (const a of actionRows) {
      const verb = a.action.toUpperCase();
      const dir = a.action === "withdraw" ? "from" : "to  ";
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
async function computeAllocationsForRebalance(provider) {
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

  const rawAllocations = computeAllocation({
    strategies: state.strategies,
    apys,
    vaultBalance: state.vaultBalance,
    shortfall: state.shortfall,
  });

  const filtered = filterActions(
    rawAllocations,
    state.shortfall,
    state.vaultBalance
  );
  const sorted = sortActions(filtered);

  printAllocationTable({
    allocations: sorted,
    rawAllocations,
    vaultBalance: state.vaultBalance,
    shortfall: state.shortfall,
    totalValue: state.totalValue,
  });

  return { allocations: sorted, rawAllocations, state, apys };
}

module.exports = {
  readOnChainState,
  fetchMorphoApys,
  computeAllocation,
  filterActions,
  sortActions,
  fmtUsd,
  printAllocationTable,
  computeAllocationsForRebalance,
  strategiesConfig,
  defaultConstraints,
};
