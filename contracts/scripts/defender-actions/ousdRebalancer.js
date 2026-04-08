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
// When false (default), runs all computation and posts Discord alerts without sending txs.
// Set BROADCAST_REBALANCER_TX=true in Defender secrets to send real transactions.
let isBroadcast = false;

const rebalancerModuleAbi = [
  "function processWithdrawalsAndDeposits(address[] calldata, uint256[] calldata, address[] calldata, uint256[] calldata) external",
  "function remainingDailyLimit() external view returns (uint256)",
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
  idealActions,
  state,
  warnings = [],
}) => {
  const timestamp = new Date().toUTCString().replace(/ GMT$/, " UTC");
  const header = !isBroadcast
    ? `🔄 **OUSD Rebalancer** — ${timestamp}  \`[DRY RUN]\``
    : `🔄 **OUSD Rebalancer** — ${timestamp}`;

  // Current allocations (from on-chain state): name | balance | avail. liquidity | APYs
  const currentLines = allActions.map((a) => {
    const avail =
      a.withdrawableLiquidity != null
        ? formatUSDC(a.withdrawableLiquidity)
        : "  n/a ";
    const avgStr = `${(a.apy * 100).toFixed(2)}%`;
    const spotStr = `${((a.spotApy || 0) * 100).toFixed(2)}%`;
    return `  ${a.name.padEnd(20)} ${formatUSDC(a.balance).padStart(
      9
    )}  ${avail.padStart(9)}  ${avgStr} 1h  ${spotStr} spot`;
  });
  currentLines.push(
    `  ${"Vault idle".padEnd(20)} ${formatUSDC(state.vaultBalance).padStart(9)}`
  );

  // Ideal allocations (from computeIdealAllocation, before feasibility filtering)
  const idealLines = idealActions.map((a) => {
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
    "**Ideal Allocations**",
    "```",
    ...idealLines,
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
  isBroadcast = event?.secrets?.BROADCAST_REBALANCER_TX === "true";
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

  // Configure subsquid endpoint for APY reads
  process.env.ORIGIN_SUBSQUID_SERVER =
    event.secrets?.ORIGIN_SUBSQUID_SERVER ||
    "https://origin.squids.live/origin-squid:prod/api/graphql";

  // Build chain providers for on-chain reads (balances, max withdrawals)
  const providers = { 1: provider };
  if (event.secrets.BASE_PROVIDER_URL) {
    providers[8453] = new ethers.providers.JsonRpcProvider(
      event.secrets.BASE_PROVIDER_URL
    );
  }
  if (event.secrets.HYPEREVM_PROVIDER_URL) {
    providers[999] = new ethers.providers.JsonRpcProvider(
      event.secrets.HYPEREVM_PROVIDER_URL
    );
  }

  // Compute off-chain recommendations (also prints the allocation table to logs)
  const plan = await buildRebalancePlan(providers);
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

  const rebalancerModule = new ethers.Contract(
    addresses.mainnet.OUSDRebalancerModule,
    rebalancerModuleAbi,
    signer
  );

  // Check if daily movement limit is exhausted
  const remaining = await rebalancerModule.remainingDailyLimit();
  if (remaining.isZero()) {
    log("Daily movement limit reached — skipping execution");
    if (webhookUrl) {
      postToDiscord(
        webhookUrl,
        "⚠️ **OUSD Rebalancer** — Daily movement limit reached, skipping execution"
      ).catch((err) => log(`Discord post failed: ${err.message}`));
    }
    return;
  }

  const withdrawals = actions.filter((a) => a.action === ACTION_WITHDRAW);
  const deposits = actions.filter((a) => a.action === ACTION_DEPOSIT);

  // Run a contract call or log what would have been called in dry-run mode.
  // On a live run, posts the tx hash to Discord after confirmation.
  const executeTx = async (contractCall) => {
    if (!isBroadcast) {
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
