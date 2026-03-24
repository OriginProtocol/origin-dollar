const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");

const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");
const {
  buildRebalancePlan,
  ACTION_DEPOSIT,
  ACTION_WITHDRAW,
  ACTION_NONE,
} = require("../../utils/rebalancer");
const { postToDiscord } = require("../../utils/discord");
const { CROSS_CHAIN_BRIDGE_LIMIT } = require("../../utils/cctp");

const log = require("../../utils/logger")("action:ousdRebalancer");
// Set to true to run all computation and post Discord alerts without sending any txs
const IS_DRY_RUN = true;

const rebalancerModuleAbi = [
  "function processWithdrawalsAndDeposits(address[] calldata, uint256[] calldata, address[] calldata, uint256[] calldata) external",
];

// Return the action amount, capping cross-chain moves at the bridge limit
const cappedAmount = (a) => {
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
  warnings = [],
}) => {
  const timestamp = new Date().toUTCString().replace(/ GMT$/, " UTC");
  const header = IS_DRY_RUN
    ? `🔄 **OUSD Rebalancer** — ${timestamp}  \`[DRY RUN]\``
    : `🔄 **OUSD Rebalancer** — ${timestamp}`;

  // Current allocations (from on-chain state)
  const currentLines = allActions.map((a) => {
    return `  ${a.name.padEnd(20)} ${formatUSDC(a.balance).padStart(9)}  ${(
      a.apy * 100
    ).toFixed(2)}% APY`;
  });
  currentLines.push(
    `  ${"Vault idle".padEnd(20)} ${formatUSDC(state.vaultBalance).padStart(9)}`
  );

  // Optimal allocations (from computeOptimalAllocation, before feasibility filtering)
  const optimalLines = optimalActions.map((a) => {
    const deltaStr = a.delta.isZero() ? "(unchanged)" : formatDelta(a.delta);
    return `  ${a.name.padEnd(20)} ${formatUSDC(a.targetBalance).padStart(
      9
    )}  ${deltaStr}`;
  });

  // Recommended (feasible) actions
  const executableActions = allActions.filter((a) => a.action !== ACTION_NONE);
  let actionLines;
  if (executableActions.length === 0) {
    actionLines = ["  No rebalancing actions required"];
  } else {
    actionLines = executableActions.map((a) => {
      const label = a.action.toUpperCase().padEnd(8);
      const chain = a.isCrossChain ? "(cross-chain)" : "(same-chain)";
      return `  ${label}  ${a.name.padEnd(20)} ${formatUSDC(
        cappedAmount(a)
      ).padStart(9)}  ${chain}`;
    });
  }

  const lines = [
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
  ];

  if (warnings.length > 0) {
    lines.push("");
    lines.push("**⚠️ Warnings**");
    lines.push("```");
    for (const w of warnings) {
      lines.push(`  ${w}`);
    }
    lines.push("```");
  }

  return lines.join("\n");
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

  const webhookUrl = event.secrets?.DISCORD_WEBHOOK_URL;

  // Compute off-chain recommendations (also prints the allocation table to logs)
  const plan = await buildRebalancePlan(provider);
  const { actions: allActions } = plan;
  const actions = allActions.filter((a) => a.action !== ACTION_NONE);

  // Post to Discord before executing so the alert appears even if the tx reverts
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

  const withdrawals = actions.filter((a) => a.action === ACTION_WITHDRAW);
  const deposits = actions.filter((a) => a.action === ACTION_DEPOSIT);

  const rebalancerModule = new ethers.Contract(
    addresses.mainnet.OUSDRebalancerModule,
    rebalancerModuleAbi,
    signer
  );

  // Run a contract call or log what would have been called in dry-run mode.
  // On a live run, posts the tx hash to Discord after confirmation.
  const executeTx = async (contractCall) => {
    if (IS_DRY_RUN) {
      log(`[DRY RUN] Skipping contract calls in DRY MODE`);
      return;
    }
    const tx = await contractCall();
    await logTxDetails(tx, "Rebalance Tx");
    if (webhookUrl) {
      postToDiscord(webhookUrl, `✅ Rebalance Tx sent: \`${tx.hash}\``).catch(
        (err) => log(`Discord tx hash post failed: ${err.message}`)
      );
    }
  };

  // Cross-chain withdrawals need bridge settlement before deposits are safe.
  // Pass empty deposit arrays to defer them until the next run.
  const hasCrossChainWithdrawal = withdrawals.some((a) => a.isCrossChain);
  const deferDeposits = hasCrossChainWithdrawal;

  await executeTx(() =>
    rebalancerModule.processWithdrawalsAndDeposits(
      withdrawals.map((a) => a.address),
      withdrawals.map(cappedAmount),
      deferDeposits ? [] : deposits.map((a) => a.address),
      deferDeposits ? [] : deposits.map(cappedAmount)
    )
  );
};

module.exports = { handler };
