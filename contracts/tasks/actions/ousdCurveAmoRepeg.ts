import { action, types } from "../lib/action";
import { runCurveAmoRepeg } from "../lib/curveAmoRepeg";
import { logTxDetails } from "../../utils/txLogger";

action({
  name: "ousdCurveAmoRepeg",
  description:
    "Remove and burn excess OUSD through its restricted Safe module to reach a Curve OUSD/USDC sell-price target",
  chains: [1],
  params: (t) => {
    t.addOptionalParam(
      "sellPrice",
      "USDC received for selling 1 OUSD",
      "0.9998",
      types.string
    );
    t.addFlag(
      "dryrun",
      "Validate and simulate the exact module call without submitting"
    );
  },
  run: async ({ signer, chainId, args, log }) => {
    const tx = await runCurveAmoRepeg({
      signer,
      chainId,
      asset: "OUSD",
      sellPrice: args.sellPrice,
      dryrun: args.dryrun,
      log,
    });
    if (tx) await logTxDetails(tx, "ousdCurveAmoRepeg");
  },
});
