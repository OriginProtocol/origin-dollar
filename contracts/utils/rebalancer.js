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
];

const crossChainStrategyAbi = [
  "function checkBalance(address _asset) external view returns (uint256)",
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
  },
  {
    name: "Base Morpho",
    address: addresses.mainnet.CrossChainMasterStrategy,
    // Morpho V1 vault on Base for APY lookup
    morphoVaultAddress: "0x581Cc9a73Ec7431723A4a80699B8f801205841F1",
    morphoChainId: 8453,
    isCrossChain: true,
  },
];

// Default constraints
const defaultConstraints = {
  minEthereumBps: 2000, // 20% minimum on Ethereum
  maxPerChainBps: 6500, // 65% max on any single chain
  minMoveAmount: 5_000_000_000, // $5K in USDC (6 decimals)
  crossChainMinAmount: 50_000_000_000, // $50K
};

/**
 * Read on-chain state: strategy balances, vault idle USDC, withdrawal queue.
 * @param {object} provider - ethers provider
 * @returns {object} { strategies: [{name, address, balance, isCrossChain, isTransferPending}], vaultBalance, shortfall, totalValue }
 */
async function readOnChainState(provider) {
  const vault = new ethers.Contract(
    addresses.mainnet.VaultProxy,
    vaultAbi,
    provider
  );
  const usdc = new ethers.Contract(addresses.mainnet.USDC, erc20Abi, provider);

  // Read vault state
  const [queueMeta, vaultBalance, totalValue] = await Promise.all([
    vault.withdrawalQueueMetadata(),
    usdc.balanceOf(addresses.mainnet.VaultProxy),
    vault.totalValue(),
  ]);

  const shortfall = queueMeta.queued.sub(queueMeta.claimable);

  // Read strategy balances
  const strategies = await Promise.all(
    strategiesConfig.map(async (cfg) => {
      const abi = cfg.isCrossChain ? crossChainStrategyAbi : strategyAbi;
      const strategy = new ethers.Contract(cfg.address, abi, provider);

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
        balance,
        isTransferPending,
      };
    })
  );

  return { strategies, vaultBalance, shortfall, totalValue };
}

/**
 * Fetch APY from Morpho GraphQL API for a list of vaults.
 * @param {Array} vaults - [{morphoVaultAddress, morphoChainId}]
 * @returns {object} map of morphoVaultAddress -> apy (as a float, e.g. 0.05 for 5%)
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
 * Pure computation: given balances and APYs, compute target allocation.
 *
 * @param {object} params
 * @param {Array}  params.strategies - [{name, balance (BigNumber), isCrossChain, isTransferPending, morphoVaultAddress}]
 * @param {object} params.apys - map of morphoVaultAddress -> apy (float)
 * @param {BigNumber} params.vaultBalance - idle USDC in vault
 * @param {BigNumber} params.shortfall - queued - claimable withdrawal amount
 * @param {object} [params.constraints] - override default constraints
 * @returns {Array} [{name, address, balance, targetBalance, delta, apy, action}]
 */
function computeAllocation({
  strategies,
  apys,
  vaultBalance,
  shortfall,
  constraints: overrides = {},
}) {
  const constraints = { ...defaultConstraints, ...overrides };

  // Total capital = sum of all strategy balances + vault idle USDC
  const totalCapital = strategies.reduce(
    (sum, s) => sum.add(s.balance),
    vaultBalance
  );

  if (totalCapital.isZero()) {
    return strategies.map((s) => ({
      ...s,
      apy: apys[s.morphoVaultAddress] || 0,
      targetBalance: BigNumber.from(0),
      delta: BigNumber.from(0),
      action: "none",
    }));
  }

  // Reserve vault balance: max(shortfall, 0) stays as idle USDC in the vault
  // This ensures the withdrawal queue can be serviced
  const reservedForVault = shortfall.gt(0) ? shortfall : BigNumber.from(0);
  const deployableCapital = totalCapital.sub(reservedForVault);

  if (deployableCapital.lte(0)) {
    return strategies.map((s) => ({
      ...s,
      apy: apys[s.morphoVaultAddress] || 0,
      targetBalance: BigNumber.from(0),
      delta: s.balance.mul(-1),
      action: s.balance.gt(0) ? "withdraw" : "none",
    }));
  }

  // Get APYs for each strategy
  const strategyApys = strategies.map((s) => apys[s.morphoVaultAddress] || 0);
  const totalApy = strategyApys.reduce((sum, a) => sum + a, 0);

  // Compute raw proportional allocation based on APY
  // If all APYs are 0, split evenly
  let rawWeights;
  if (totalApy === 0) {
    rawWeights = strategies.map(() => 1 / strategies.length);
  } else {
    rawWeights = strategyApys.map((a) => a / totalApy);
  }

  // Apply constraints: min Ethereum, max per chain
  const clampedWeights = applyConstraints(strategies, rawWeights, constraints);

  // Compute target balances from clamped weights
  const results = strategies.map((s, i) => {
    const targetBalance = deployableCapital
      .mul(Math.round(clampedWeights[i] * 10000))
      .div(10000);

    const delta = targetBalance.sub(s.balance);

    let action = "none";
    if (delta.gt(0)) action = "deposit";
    else if (delta.lt(0)) action = "withdraw";

    return {
      name: s.name,
      address: s.address,
      isCrossChain: s.isCrossChain,
      isTransferPending: s.isTransferPending,
      morphoVaultAddress: s.morphoVaultAddress,
      balance: s.balance,
      apy: strategyApys[i],
      targetBalance,
      delta,
      action,
    };
  });

  return results;
}

/**
 * Apply allocation constraints and re-normalize weights.
 */
function applyConstraints(strategies, rawWeights, constraints) {
  const weights = [...rawWeights];
  const n = strategies.length;

  // Find Ethereum strategy index (the non-cross-chain one)
  const ethIdx = strategies.findIndex((s) => !s.isCrossChain);

  // Enforce minimum Ethereum allocation
  if (ethIdx >= 0) {
    const minEth = constraints.minEthereumBps / 10000;
    if (weights[ethIdx] < minEth) {
      const deficit = minEth - weights[ethIdx];
      weights[ethIdx] = minEth;
      // Distribute deficit proportionally among others
      const otherTotal = weights.reduce(
        (s, w, i) => (i !== ethIdx ? s + w : s),
        0
      );
      if (otherTotal > 0) {
        for (let i = 0; i < n; i++) {
          if (i !== ethIdx) {
            weights[i] -= deficit * (weights[i] / otherTotal);
          }
        }
      }
    }
  }

  // Enforce max per chain
  const maxPerChain = constraints.maxPerChainBps / 10000;
  for (let i = 0; i < n; i++) {
    if (weights[i] > maxPerChain) {
      const excess = weights[i] - maxPerChain;
      weights[i] = maxPerChain;
      // Distribute excess proportionally among others
      const otherTotal = weights.reduce((s, w, j) => (j !== i ? s + w : s), 0);
      if (otherTotal > 0) {
        for (let j = 0; j < n; j++) {
          if (j !== i) {
            weights[j] += excess * (weights[j] / otherTotal);
          }
        }
      }
    }
  }

  // Re-normalize to ensure weights sum to 1
  const total = weights.reduce((s, w) => s + w, 0);
  if (total > 0) {
    for (let i = 0; i < n; i++) {
      weights[i] /= total;
    }
  }

  return weights;
}

/**
 * Filter results: skip moves that are too small or blocked.
 */
function filterActions(allocations, constraints = defaultConstraints) {
  return allocations.map((a) => {
    const absDelta = a.delta.abs();

    // Skip if transfer is pending on cross-chain strategy
    if (a.isCrossChain && a.isTransferPending && a.action !== "none") {
      return { ...a, action: "none", reason: "transfer pending" };
    }

    // Skip if move amount is below minimum
    if (a.action !== "none" && absDelta.lt(constraints.minMoveAmount)) {
      return { ...a, action: "none", reason: "below min move" };
    }

    // Skip if cross-chain move is below cross-chain minimum
    if (
      a.isCrossChain &&
      a.action !== "none" &&
      absDelta.lt(constraints.crossChainMinAmount)
    ) {
      return { ...a, action: "none", reason: "below cross-chain min" };
    }

    return a;
  });
}

/**
 * Print a human-readable table of current vs recommended allocations.
 */
function printAllocationTable({
  allocations,
  vaultBalance,
  shortfall,
  totalValue,
}) {
  const fmt = (bn) => formatUnits(bn, USDC_DECIMALS);
  const fmt18 = (bn) => formatUnits(bn, 18);
  const totalCapital = allocations.reduce(
    (sum, a) => sum.add(a.balance),
    vaultBalance
  );

  console.log("\n=== OUSD Rebalancer Status ===\n");
  console.log(`Total vault value    : ${fmt18(totalValue)} OUSD`);
  console.log(`Withdrawal shortfall : ${fmt(shortfall)} USDC`);

  console.log("\n--- Allocations ---\n");
  console.log(
    `${"Strategy".padEnd(20)} ${"Current".padStart(16)} ${"Target".padStart(
      16
    )} ${"Delta".padStart(16)} ${"APY".padStart(8)} ${"Action".padStart(12)}`
  );
  console.log("-".repeat(92));

  for (const a of allocations) {
    const currentPct = totalCapital.gt(0)
      ? `(${(Number(a.balance.mul(10000).div(totalCapital)) / 100).toFixed(
          1
        )}%)`
      : "";
    const targetPct = totalCapital.gt(0)
      ? `(${(
          Number(a.targetBalance.mul(10000).div(totalCapital)) / 100
        ).toFixed(1)}%)`
      : "";
    const apyStr = `${(a.apy * 100).toFixed(2)}%`;
    const deltaStr = a.delta.gte(0) ? `+${fmt(a.delta)}` : fmt(a.delta);

    let actionStr = a.action;
    if (a.reason) actionStr = `skip: ${a.reason}`;

    console.log(
      `${a.name.padEnd(20)} ${(fmt(a.balance) + " " + currentPct).padStart(
        16 + currentPct.length
      )} ${(fmt(a.targetBalance) + " " + targetPct).padStart(
        16 + targetPct.length
      )} ${deltaStr.padStart(16)} ${apyStr.padStart(8)} ${actionStr.padStart(
        12
      )}`
    );
  }

  // Vault idle USDC row
  const vaultPct = totalCapital.gt(0)
    ? `(${(Number(vaultBalance.mul(10000).div(totalCapital)) / 100).toFixed(
        1
      )}%)`
    : "";
  const vaultTargetPct = totalCapital.gt(0)
    ? `(${(Number(shortfall.mul(10000).div(totalCapital)) / 100).toFixed(1)}%)`
    : "";
  const vaultDelta = shortfall.sub(vaultBalance);
  const vaultDeltaStr = vaultDelta.gte(0)
    ? `+${fmt(vaultDelta)}`
    : fmt(vaultDelta);
  console.log(
    `${"Vault (idle)".padEnd(20)} ${(
      fmt(vaultBalance) +
      " " +
      vaultPct
    ).padStart(16 + vaultPct.length)} ${(
      fmt(shortfall) +
      " " +
      vaultTargetPct
    ).padStart(16 + vaultTargetPct.length)} ${vaultDeltaStr.padStart(
      16
    )} ${"—".padStart(8)} ${"—".padStart(12)}`
  );

  console.log("-".repeat(92));
  console.log(`${"Total".padEnd(20)} ${fmt(totalCapital).padStart(16)}`);
  console.log("");
}

/**
 * Main entry: read state, fetch APYs, compute allocation, print table.
 * @param {object} provider - ethers provider or signer
 */
async function computeAllocationsForRebalance(provider) {
  log("Reading on-chain state...");
  const state = await readOnChainState(provider);

  log("Fetching Morpho APYs...");
  const apys = await fetchMorphoApys(
    state.strategies.map((s) => ({
      morphoVaultAddress: s.morphoVaultAddress,
      morphoChainId: s.morphoChainId,
    }))
  );

  const allocations = computeAllocation({
    strategies: state.strategies,
    apys,
    vaultBalance: state.vaultBalance,
    shortfall: state.shortfall,
  });

  const filtered = filterActions(allocations);

  printAllocationTable({
    allocations: filtered,
    vaultBalance: state.vaultBalance,
    shortfall: state.shortfall,
    totalValue: state.totalValue,
  });

  return { allocations: filtered, state, apys };
}

module.exports = {
  readOnChainState,
  fetchMorphoApys,
  computeAllocation,
  filterActions,
  applyConstraints,
  printAllocationTable,
  computeAllocationsForRebalance,
  strategiesConfig,
  defaultConstraints,
};
