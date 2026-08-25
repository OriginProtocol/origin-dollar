/// <reference types="hardhat/types/runtime" />

import { action } from "../lib/action";

const { snapBalances } = require("../validatorCompound");

action({
  name: "snapBalances",
  chains: [1],
  description: "Takes a snapshot of the staking strategy's balance",
  run: async ({ args }) => {
    await snapBalances(args);
  },
});
