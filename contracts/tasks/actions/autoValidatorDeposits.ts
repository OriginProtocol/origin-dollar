/// <reference types="hardhat/types/runtime" />

import { types } from "../lib/action";
import { action } from "../lib/action";

const { autoValidatorDeposits } = require("../validatorCompound");

action({
  name: "autoValidatorDeposits",
  chains: [1],
  description:
    "Automatically withdraw ETH/WETH from the strategy if needed for withdrawals, then deposit WETH to validators with a balance under 2030 ETH from the largest balance to the smallest",
  params: (t) => {
    t.addOptionalParam(
      "dryrun",
      "Do not send any txs to the staking strategy contract",
      false,
      types.boolean
    );
  },
  run: async ({ signer, args }) => {
    await autoValidatorDeposits({ ...args, signer });
  },
});
