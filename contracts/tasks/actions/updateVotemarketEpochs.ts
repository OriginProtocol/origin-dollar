/// <reference types="hardhat/types/runtime" />

import { types } from "hardhat/config";
import { action } from "../lib/action";

const { updateVotemarketEpochsTask } = require("../votemarket");

action({
  name: "updateVotemarketEpochs",
  chains: [42161], // Arbitrum
  description:
    "Update Votemarket epochs for all Curve Pool Booster campaigns on Arbitrum",
  params: (t) => {
    t.addOptionalParam(
      "dryRun",
      "If true, log actions but do not send transactions",
      false,
      types.boolean
    );
  },
  run: async ({ args }) => {
    await updateVotemarketEpochsTask({ ...args });
  },
});
