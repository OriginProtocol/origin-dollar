import { action, types } from "../lib/action";
import { getContract } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";
import { loadConfig } from "../../utils/ogn-buyback-config";

/**
 * Splits accumulated protocol fees between the operations wallet and the OGN
 * CoW harvester.
 *
 * Runs daily rather than weekly on purpose: the harvester has no on-chain price
 * protection, so whatever is sitting there is exposed to the CoW bot key. A
 * daily cadence caps that exposure at roughly one day of fees.
 */
action({
  name: "feeSplitterDistribute",
  description:
    "Distribute protocol fees between operations and the OGN buyback",
  chains: [1],
  params: (t) => {
    t.addOptionalParam(
      "dryrun",
      "Report what would be distributed without broadcasting",
      false,
      types.boolean
    );
  },
  run: async ({ signer, args, log }) => {
    const dryrun = !!args.dryrun;
    const config = loadConfig();

    const feeSplitter = await getContract("FeeSplitter");
    const assets: string[] = await feeSplitter.getSupportedAssets();

    if (assets.length === 0) {
      log.warn("FeeSplitter has no supported assets; nothing to distribute");
      return;
    }

    // previewDistribute returns (0, 0) below the asset's dust floor, so this
    // also tells us whether the call would be a no-op.
    let anythingToDo = false;
    for (const asset of assets) {
      const [opsAmount, buybackAmount] = await feeSplitter.previewDistribute(
        asset
      );
      const total = opsAmount.add(buybackAmount);
      if (total.isZero()) {
        log.info(`${asset}: below dust floor, skipping`);
        continue;
      }
      anythingToDo = true;
      log.info(
        `${asset}: ${opsAmount.toString()} to operations, ` +
          `${buybackAmount.toString()} to buyback`
      );
    }

    if (!anythingToDo) {
      log.info(
        "Every supported asset is below its dust floor; not sending a tx"
      );
      return;
    }

    if (dryrun) {
      log.info("Dry run, not broadcasting");
      return;
    }

    // `distribute` is overloaded, so the signature has to be explicit: ethers
    // throws "multiple matching functions" on the bare name.
    const tx = await feeSplitter.connect(signer)["distribute()"]();
    await logTxDetails(tx, "distribute on FeeSplitter");

    log.info(
      `Operations share is ${config.split.operationsBps} bps; ` +
        `the remainder buys OGN via ${await feeSplitter.harvester()}`
    );
  },
});
