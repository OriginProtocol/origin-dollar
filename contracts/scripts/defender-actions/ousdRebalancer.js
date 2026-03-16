const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const { parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");
const { buildRebalancePlan } = require("../../utils/rebalancer");
const { postToDiscord } = require("../../utils/discord");

const log = require("../../utils/logger")("action:ousdRebalancer");

// Set to true to run all computation and post Discord alerts without sending any txs
const IS_DRY_RUN = true;

// Maximum amount for any single cross-chain transfer (CCTP bridge limit)
const CROSS_CHAIN_BRIDGE_LIMIT = parseUnits("10000000", 6); // 10M USDC

const rebalancerModuleAbi = [
  "function processWithdrawals(address[] calldata, uint256[] calldata) external",
  "function processDeposits(address[] calldata, uint256[] calldata) external",
  "function processWithdrawalsAndDeposits(address[] calldata, uint256[] calldata, address[] calldata, uint256[] calldata) external",
];

// Return the action amount, capping cross-chain moves at the bridge limit
const actionAmount = (a) => {
  const amt = a.delta.abs();
  return a.isCrossChain && amt.gt(CROSS_CHAIN_BRIDGE_LIMIT)
    ? CROSS_CHAIN_BRIDGE_LIMIT
    : amt;
};

// Format a USDC BigNumber (6 decimals) as a human-readable dollar string
const formatUSDC = (bn) => {
  const n = Number(bn.toString()) / 1e6;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};

// Format a delta BigNumber as a signed dollar string, e.g. "+$1.20M" or "-$0.50K"
const formatDelta = (bn) => {
  const sign = bn.gte(0) ? "+" : "-";
  return `${sign}${formatUSDC(bn.abs())}`;
};

// Build the Discord message from a completed buildRebalancePlan result
const buildDiscordMessage = ({
  actions: allActions,
  optimalActions,
  state,
}) => {
  const timestamp = new Date().toUTCString().replace(/ GMT$/, " UTC");
  const header = IS_DRY_RUN
    ? `🔄 **OUSD Rebalancer** — ${timestamp}  \`[DRY RUN]\``
    : `🔄 **OUSD Rebalancer** — ${timestamp}`;

  // Current allocations (from on-chain state)
  const currentLines = allActions.map((a) => {
    const apy = a.isAmo ? "—  (AMO)" : `${(a.apy * 100).toFixed(2)}% APY`;
    return `  ${a.name.padEnd(20)} ${formatUSDC(a.balance).padStart(
      9
    )}  ${apy}`;
  });
  currentLines.push(
    `  ${"Vault idle".padEnd(20)} ${formatUSDC(state.vaultBalance).padStart(9)}`
  );

  // Optimal allocations (from computeOptimalAllocation, before feasibility filtering)
  const optimalLines = optimalActions.map((a) => {
    if (a.isAmo)
      return `  ${a.name.padEnd(20)} ${formatUSDC(a.balance).padStart(
        9
      )}  (unchanged)`;
    const deltaStr = a.delta.isZero() ? "(unchanged)" : formatDelta(a.delta);
    return `  ${a.name.padEnd(20)} ${formatUSDC(a.targetBalance).padStart(
      9
    )}  ${deltaStr}`;
  });

  // Recommended (feasible) actions
  const executableActions = allActions.filter(
    (a) => !a.isAmo && a.action !== "none"
  );
  let actionLines;
  if (executableActions.length === 0) {
    actionLines = ["  No rebalancing actions required"];
  } else {
    actionLines = executableActions.map((a) => {
      const label = a.action.toUpperCase().padEnd(8);
      const chain = a.isCrossChain ? "(cross-chain)" : "(same-chain)";
      return `  ${label}  ${a.name.padEnd(20)} ${formatUSDC(
        actionAmount(a)
      ).padStart(9)}  ${chain}`;
    });
  }

  return [
    header,
    "",
    "**Current Allocations**",
    "```",
    ...currentLines,
    "```",
    "**Optimal Allocations**",
    "```",
    ...optimalLines,
    "```",
    "**Recommended Actions**",
    "```",
    ...actionLines,
    "```",
  ].join("\n");
};

// Entrypoint for the Defender Action
const handler = async (event) => {
  const client = new Defender(event);
  const provider = client.relaySigner.getProvider({ ethersVersion: "v5" });
  const signer = await client.relaySigner.getSigner(provider, {
    speed: "fastest",
    ethersVersion: "v5",
  });

  const { chainId } = await provider.getNetwork();
  if (chainId !== 1) {
    throw new Error(`Action must run on mainnet, not chainId ${chainId}`);
  }

  // Compute off-chain recommendations (also prints the allocation table to logs)
  const plan = await buildRebalancePlan(provider);
  const { actions: allActions } = plan;
  const actions = allActions.filter((a) => !a.isAmo && a.action !== "none");

  // Post to Discord before executing so the alert appears even if the tx reverts
  const webhookUrl = event.secrets?.DISCORD_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await postToDiscord(webhookUrl, buildDiscordMessage(plan));
    } catch (err) {
      log(`Discord notification failed: ${err.message}`);
    }
  }

  if (actions.length === 0) {
    log("No rebalancing actions required");
    return;
  }

  const withdrawals = actions.filter((a) => a.action === "withdraw");
  const deposits = actions.filter((a) => a.action === "deposit");

  const rebalancerModule = new ethers.Contract(
    addresses.mainnet.OUSDRebalancerModule,
    rebalancerModuleAbi,
    signer
  );

  const hasCrossChainWithdrawal = withdrawals.some((a) => a.isCrossChain);

  if (hasCrossChainWithdrawal) {
    // Cross-chain withdrawals are async (bridge settlement takes time).
    // Defer all deposits until the next run after the bridge confirms.
    log("Cross-chain withdrawal present — queueing withdrawals only");
    if (!IS_DRY_RUN) {
      const tx = await rebalancerModule.processWithdrawals(
        withdrawals.map((a) => a.address),
        withdrawals.map(actionAmount)
      );
      await logTxDetails(tx, "processWithdrawals");
    } else {
      log(
        `[DRY RUN] would have called processWithdrawals(${withdrawals.map(
          (a) => a.address
        )})`
      );
    }
  } else if (withdrawals.length > 0 && deposits.length > 0) {
    // All withdrawals are same-chain: freed USDC lands in the vault immediately,
    // so withdrawals and deposits can be batched into a single transaction.
    log("All-sync rebalance — processing withdrawals and deposits together");
    if (!IS_DRY_RUN) {
      const tx = await rebalancerModule.processWithdrawalsAndDeposits(
        withdrawals.map((a) => a.address),
        withdrawals.map(actionAmount),
        deposits.map((a) => a.address),
        deposits.map(actionAmount)
      );
      await logTxDetails(tx, "processWithdrawalsAndDeposits");
    } else {
      log(
        `[DRY RUN] would have called processWithdrawalsAndDeposits(${withdrawals.map(
          (a) => a.address
        )}, ${deposits.map((a) => a.address)})`
      );
    }
  } else if (withdrawals.length > 0) {
    log("Queueing withdrawals only");
    if (!IS_DRY_RUN) {
      const tx = await rebalancerModule.processWithdrawals(
        withdrawals.map((a) => a.address),
        withdrawals.map(actionAmount)
      );
      await logTxDetails(tx, "processWithdrawals");
    } else {
      log(
        `[DRY RUN] would have called processWithdrawals(${withdrawals.map(
          (a) => a.address
        )})`
      );
    }
  } else {
    log("Queueing deposits only");
    if (!IS_DRY_RUN) {
      const tx = await rebalancerModule.processDeposits(
        deposits.map((a) => a.address),
        deposits.map(actionAmount)
      );
      await logTxDetails(tx, "processDeposits");
    } else {
      log(
        `[DRY RUN] would have called processDeposits(${deposits.map(
          (a) => a.address
        )})`
      );
    }
  }
};

module.exports = { handler };
