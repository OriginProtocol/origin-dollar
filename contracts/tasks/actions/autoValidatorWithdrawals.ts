/// <reference types="hardhat/types/runtime" />

import { types } from "hardhat/config";
import { action } from "../lib/action";

const { autoValidatorWithdrawals } = require("../validatorCompound");

action({
  name: "autoValidatorWithdrawals",
  chains: [1],
  description:
    "Automatically withdraw ETH from a validators if the Vault needs WETH for user withdrawals. Start with the validator with the smallest balance over 42.25 ETH.",
  params: (t) => {
    t.addOptionalParam(
      "buffer",
      "Withdrawal buffer in basis points. 100 = 1%",
      100,
      types.int
    );
    t.addOptionalParam(
      "dryrun",
      "Do not send any txs to the staking strategy contract",
      false,
      types.boolean
    );
  },
  run: async ({ signer, args }) => {
    await autoValidatorWithdrawals({ ...args, signer });
  },
});
