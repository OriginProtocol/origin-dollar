/// <reference types="hardhat/types/runtime" />

import { types } from "../lib/action";
import { action } from "../lib/action";

const { snapBalances } = require("../validatorCompound");

action({
  name: "snapBalances",
  chains: [1],
  description: "Takes a snapshot of the staking strategy's balance",
  params: (t) => {
    t.addOptionalParam(
      "consol",
      "Call the consolidation controller instead of the strategy",
      false,
      types.boolean
    );
  },
  run: async ({ args }) => {
    await snapBalances(args);
  },
});
