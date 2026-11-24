import { action, types } from "../lib/action";
import { runCurveAmoRepeg } from "../lib/curveAmoRepeg";
import { logTxDetails } from "../../utils/txLogger";

action({
  name: "curveAmoRepeg",
  description:
    "Remove and burn excess OTokens through a restricted Safe module to reach a Curve sell-price target",
  chains: [1, 8453],
  params: (t) => {
    t.addOptionalParam(
      "asset",
      "OUSD or OETH on Ethereum; SuperOETH on Base",
      "OUSD",
      types.string
    );
    t.addOptionalParam(
      "sellPrice",
      "Quote asset received for selling 1 OToken",
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
      asset: args.asset,
      sellPrice: args.sellPrice,
      dryrun: args.dryrun,
      log,
    });
    if (tx) await logTxDetails(tx, "curveAmoRepeg");
  },
});
