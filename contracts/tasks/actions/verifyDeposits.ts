/// <reference types="hardhat/types/runtime" />

import { types } from "hardhat/config";
import { action } from "../lib/action";

const { verifyDeposits } = require("../beacon");
const { cleanStateCache } = require("../../utils/beacon");

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
    t.addOptionalParam(
      "consol",
      "Call the consolidation controller instead of the strategy",
      false,
      types.boolean
    );
  },
  run: async ({ signer, args }) => {
    try {
      await verifyDeposits({ ...args, signer });
    } finally {
      cleanStateCache();
    }
  },
});
