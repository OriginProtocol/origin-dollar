import { types, action } from "../lib/action";

const { verifyDeposits } = require("../beacon");

action({
  name: "verifyDeposits",
  chains: [1],
  description: "Verify any processed deposit on the Beacon chain",
  params: (t) => {
    t.addOptionalParam(
      "dryrun",
      "Do not call verifyDeposit on the strategy contract. Just log the params including the proofs",
      false,
      types.boolean
    );
  },
  run: async ({ signer, args }) => {
    await verifyDeposits({ ...args, signer });
  },
});
