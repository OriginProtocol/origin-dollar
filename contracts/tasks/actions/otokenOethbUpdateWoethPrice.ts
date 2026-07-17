import { types } from "../lib/action";

import { action } from "../lib/action";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { updateWOETHOraclePrice } = require("../strategy");

action({
  name: "otokenOethbUpdateWoethPrice",
  description: "Update the wOETH oracle price on the Base BridgedWOETHStrategy",
  chains: [8453],
  params: (t) => {
    t.addOptionalParam(
      "proxy",
      "Deployment name (or address) of the BridgedWOETHStrategy proxy",
      "BridgedWOETHStrategyProxy",
      types.string
    );
  },
  run: async ({ args }) => {
    await updateWOETHOraclePrice(args);
  },
});
