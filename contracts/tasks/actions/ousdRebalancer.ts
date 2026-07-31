import { ethers } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { types } from "../lib/action";
import addresses from "../../utils/addresses";
import { logTxDetails } from "../../utils/txLogger";
import { action } from "../lib/action";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  buildRebalancePlan,
  formatAllocationTable,
  ACTION_DEPOSIT,
  ACTION_WITHDRAW,
  ACTION_NONE,
} = require("../../utils/rebalancer");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { postToDiscord } = require("../../utils/discord");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CROSS_CHAIN_BRIDGE_LIMIT } = require("../../utils/cctp");

const rebalancerModuleAbi = [
  "function processWithdrawalsAndDeposits(address[] calldata, uint256[] calldata, address[] calldata, uint256[] calldata) external",
  "function remainingDailyLimit() external view returns (uint256)",
];

const cappedAmount = (rebalanceAction: any) => {
  const amount = rebalanceAction.delta.abs();
  return rebalanceAction.isCrossChain && amount.gt(CROSS_CHAIN_BRIDGE_LIMIT)
    ? CROSS_CHAIN_BRIDGE_LIMIT
    : amount;
};

const formatUsdc = (amount: any) => {
  const n = parseFloat(formatUnits(amount, 6));
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};

action({
  name: "ousdRebalancer",
  description:
    "Plan and execute OUSD strategy rebalancing via RebalancerModule",
  chains: [1],
  params: (t) => {
    t.addOptionalParam(
      "dryrun",
      "Compute and report plan without broadcasting transactions",
      false,
      types.boolean
    );
    t.addOptionalParam(
      "discordWebhook",
      "Override Discord webhook URL (falls back to DISCORD_WEBHOOK_URL env var)",
      undefined,
      types.string
    );
  },
  run: async ({ signer, args, log }) => {
    const dryrun = !!args.dryrun;
    const webhookUrl = args.discordWebhook || process.env.DISCORD_WEBHOOK_URL;

    const plan = await buildRebalancePlan();
    const allActions = plan.actions;
    const actionable = allActions.filter((a: any) => a.action !== ACTION_NONE);

    if (webhookUrl) {
      try {
        const timestamp = new Date().toUTCString().replace(/ GMT$/, " UTC");
        const dryTag = dryrun ? "  `[DRY RUN]`" : "";
        const header = `🔄 **OUSD Rebalancer** — ${timestamp}${dryTag}`;
        const table = formatAllocationTable({
          actions: allActions,
          idealActions: plan.idealActions,
          vaultBalance: plan.state.vaultBalance,
          shortfall: plan.state.shortfall,
          warnings: plan.warnings,
          compact: true,
          baselineMarkets: plan.baselineMarkets,
          portfolioApy: plan.portfolioApy,
        });
        await postToDiscord(webhookUrl, `${header}\n\`\`\`\n${table}\n\`\`\``);
      } catch (err: any) {
        log.warn(`Discord notification failed: ${err?.message || String(err)}`);
      }
    }

    if (actionable.length === 0) {
      log.info("No rebalancing actions required");
      return;
    }

    const rebalancerModule = new ethers.Contract(
      addresses.mainnet.OUSDRebalancerModule,
      rebalancerModuleAbi,
      signer
    );

    const totalPlanned = actionable.reduce(
      (sum: any, rebalanceAction: any) =>
        sum.add(cappedAmount(rebalanceAction)),
      ethers.BigNumber.from(0)
    );

    const remaining = dryrun
      ? ethers.constants.MaxUint256
      : await rebalancerModule.remainingDailyLimit();

    if (totalPlanned.gt(remaining)) {
      const warning =
        `Daily limit too low for batch: need ${formatUsdc(totalPlanned)}, ` +
        `remaining ${formatUsdc(remaining)}`;
      log.warn(warning);
      if (webhookUrl) {
        await postToDiscord(
          webhookUrl,
          `⚠️ **OUSD Rebalancer** — Planned movement ${formatUsdc(
            totalPlanned
          )} exceeds remaining daily limit ${formatUsdc(
            remaining
          )}, skipping execution`
        ).catch((err: any) =>
          log.warn(
            `Discord warning post failed: ${err?.message || String(err)}`
          )
        );
      }
      return;
    }

    if (dryrun) {
      log.info("[DRY RUN] Skipping RebalancerModule transaction");
      return;
    }

    const withdrawals = actionable.filter(
      (a: any) => a.action === ACTION_WITHDRAW
    );
    const deposits = actionable.filter((a: any) => a.action === ACTION_DEPOSIT);

    const hasCrossChainWithdrawal = withdrawals.some(
      (a: any) => a.isCrossChain
    );
    const deferDeposits = hasCrossChainWithdrawal;

    const tx = await rebalancerModule.processWithdrawalsAndDeposits(
      withdrawals.map((a: any) => a.address),
      withdrawals.map(cappedAmount),
      deferDeposits ? [] : deposits.map((a: any) => a.address),
      deferDeposits ? [] : deposits.map(cappedAmount)
    );
    await logTxDetails(tx, "OUSD rebalance");

    if (webhookUrl) {
      await postToDiscord(
        webhookUrl,
        `✅ OUSD rebalance tx sent: \`${tx.hash}\``
      ).catch((err: any) =>
        log.warn(`Discord tx hash post failed: ${err?.message || String(err)}`)
      );
    }
  },
});
