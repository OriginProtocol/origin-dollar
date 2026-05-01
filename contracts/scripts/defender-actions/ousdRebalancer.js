const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");

const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");
const {
  buildRebalancePlan,
  formatAllocationTable,
  ACTION_DEPOSIT,
  ACTION_WITHDRAW,
  ACTION_NONE,
} = require("../../utils/rebalancer");
const { initSecrets } = require("../../utils/rebalancer-config");
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

  // Make Defender secrets available to rebalancer config (RPC URLs, Subsquid, etc.)
  initSecrets(event.secrets);

  // Compute off-chain recommendations (also prints the allocation table to logs)
  const plan = await buildRebalancePlan();
  const { actions: allActions } = plan;
  const actions = allActions.filter((a) => a.action !== ACTION_NONE);

  // Post to Discord before executing so the alert appears even if the tx reverts
  if (webhookUrl) {
    try {
      const timestamp = new Date().toUTCString().replace(/ GMT$/, " UTC");
      const dryTag = !isBroadcast ? "  `[DRY RUN]`" : "";
      const header = `🔄 **OUSD Rebalancer** — ${timestamp}${dryTag}`;
      const table = formatAllocationTable({
        actions: allActions,
        idealActions: plan.idealActions,
        vaultBalance: plan.state.vaultBalance,
        shortfall: plan.state.shortfall,
        warnings: plan.warnings,
        compact: true,
        baselineMarkets: plan.baselineMarkets,
      });
      await postToDiscord(webhookUrl, `${header}\n\`\`\`\n${table}\n\`\`\``);
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

  const withdrawals = actions.filter((a) => a.action === ACTION_WITHDRAW);
  const deposits = actions.filter((a) => a.action === ACTION_DEPOSIT);

  // Check if planned movement fits within remaining daily limit
  const remaining = isBroadcast
    ? await rebalancerModule.remainingDailyLimit()
    : ethers.constants.MaxUint256;
  const totalPlanned = actions.reduce(
    (sum, a) => sum.add(cappedAmount(a)),
    ethers.BigNumber.from(0)
  );

  if (totalPlanned.gt(remaining)) {
    log(
      `Daily limit too low for batch: need ${formatUSDC(totalPlanned)}, ` +
        `remaining ${formatUSDC(remaining)}`
    );
    if (webhookUrl) {
      postToDiscord(
        webhookUrl,
        `⚠️ **OUSD Rebalancer** — Planned movement ${formatUSDC(
          totalPlanned
        )} exceeds remaining daily limit ${formatUSDC(
          remaining
        )}, skipping execution`
      ).catch((err) => log(`Discord post failed: ${err.message}`));
    }
    return;
  }

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
