import { action, types } from "../lib/action";
import { getContractAt } from "../lib/contracts";
import { get as getDeployment } from "../lib/deployments";
import { getDigestSigner } from "../lib/signer";
import {
  COW_API_BASE,
  DEFAULT_APP_DATA,
  DEFAULT_SLIPPAGE_BPS,
  HARVESTER_ABI,
  HARVESTERS,
  ORDER_VALIDITY_SECONDS,
  harvestToken,
  type HarvesterId,
  type TokenResult,
} from "../lib/cowHarvest";

/**
 * Posts CoW sell orders for everything a CoW harvester holds. No transaction is
 * sent: orders are signed off-chain with the Talos key, which must be the
 * harvester's `bot()`, and settled by CoW solvers through EIP-1271.
 *
 * The harvester has no on-chain price check beyond `buyAmount > 0`, so the
 * slippage applied to the CoW quote is the only price protection.
 */
action({
  name: "cowHarvest",
  description:
    "Sell a CoW harvester's balances through CoW orders signed with the Talos key",
  chains: [1],
  params: (t) => {
    t.addParam("harvester", "Harvester to run: ousd, oeth or ogn");
    t.addOptionalParam(
      "slippageBps",
      "Slippage applied to the CoW quote, in bps",
      DEFAULT_SLIPPAGE_BPS,
      types.int
    );
    t.addFlag("dryrun", "Quote and sign, but do not post any order");
  },
  run: async ({ signer, args, log }) => {
    const id = String(args.harvester ?? "").toLowerCase() as HarvesterId;
    const config = HARVESTERS[id];
    if (!config) {
      throw new Error(
        `Unknown --harvester '${args.harvester}', expected one of ` +
          Object.keys(HARVESTERS).join(", ")
      );
    }
    const dryrun = !!args.dryrun;
    const slippageBps = Number(args.slippageBps ?? DEFAULT_SLIPPAGE_BPS);
    if (
      !Number.isInteger(slippageBps) ||
      slippageBps < 0 ||
      slippageBps >= 10_000
    ) {
      throw new Error(`Invalid --slippage-bps ${args.slippageBps}`);
    }

    const provider = signer.provider!;
    const harvester = await getContractAt(
      HARVESTER_ABI,
      getDeployment(config.deployment).address
    );
    const erc20 = (address: string) =>
      getContractAt(
        ["function balanceOf(address) view returns (uint256)"],
        address
      );

    if (!(await harvester.allowedBuyToken(config.buyToken))) {
      throw new Error(
        `Buy token ${config.buyToken} not allowed on ${harvester.address}`
      );
    }
    if (!(await harvester.allowedReceiver(config.receiver))) {
      throw new Error(
        `Receiver ${config.receiver} not allowed on ${harvester.address}`
      );
    }

    const digestSigner = await getDigestSigner();
    const bot: string = await harvester.bot();
    log.info(
      `${id} harvester ${harvester.address}, bot ${bot}, signer ${digestSigner.address}`
    );
    if (bot.toLowerCase() !== digestSigner.address.toLowerCase()) {
      const msg =
        `Signer ${digestSigner.address} is not the harvester bot (${bot}); ` +
        `call setBot from the harvester owner first`;
      if (!dryrun) throw new Error(msg);
      log.warn(`${msg}. Dry run continues; isValidSignature will be invalid.`);
    }

    const latest = await provider.getBlock("latest");
    const ctx = {
      harvester,
      balanceOf: async (token: string) =>
        (await erc20(token)).balanceOf(harvester.address),
      signer: digestSigner,
      fetchImpl: fetch,
      apiBase: COW_API_BASE,
      appData: DEFAULT_APP_DATA,
      slippageBps,
      validTo: latest.timestamp + ORDER_VALIDITY_SECONDS,
      receiver: config.receiver,
      buyToken: config.buyToken,
      dryrun,
      log,
    };

    const results: { symbol: string; result?: TokenResult; error?: string }[] =
      [];
    for (const token of config.sellTokens) {
      try {
        results.push({
          symbol: token.symbol,
          result: await harvestToken(ctx, token),
        });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        log.error(`[${token.symbol}] ${error}`);
        results.push({ symbol: token.symbol, error });
      }
    }

    for (const { symbol, result, error } of results) {
      if (error) log.info(`[summary] ${symbol}: error`);
      else if (result!.status === "skipped")
        log.info(`[summary] ${symbol}: skipped (${result!.reason})`);
      else if (result!.status === "posted")
        log.info(`[summary] ${symbol}: posted ${result!.uid}`);
      else log.info(`[summary] ${symbol}: dry run`);
    }

    // Same exit semantics as the Railway bot: one failing token does not fail
    // the run, all of them do.
    if (results.every((r) => r.error)) {
      throw new Error(`All ${results.length} sell tokens failed`);
    }
  },
});
