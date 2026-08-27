/// <reference types="hardhat/types/runtime" />

import { types } from "../lib/action";
import { action } from "../lib/action";

const { withdrawValidator } = require("../validatorCompound");

action({
  name: "withdrawValidator",
  chains: [1],
  description:
    "Requests a partial withdrawal or full exit from a Compounding Staking Strategy validator",
  params: (t) => {
    t.addParam(
      "pubkey",
      "The validator's public key in hex format with a 0x prefix",
      undefined,
      types.string
    );
    t.addParam(
      "amount",
      "Amount of ETH to withdraw. Use 0 only to request a full validator exit.",
      undefined,
      types.float
    );
  },
  run: async ({ signer, args }) => {
    await withdrawValidator({ ...args, signer });
  },
});
