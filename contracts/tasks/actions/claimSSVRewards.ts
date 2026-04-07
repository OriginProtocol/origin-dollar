/// <reference types="hardhat/types/runtime" />

import { action } from "../lib/action";

const { claimSSVRewards } = require("../ssvRewards");

action({
  name: "claimSSVRewards",
  description: "Claim SSV rewards and forward claimed SSV",
  chains: [1],
  run: async ({ signer, log }) => {
    log.info("Claiming SSV rewards from CumulativeMerkleDrop");
    await claimSSVRewards(signer);
  },
});
