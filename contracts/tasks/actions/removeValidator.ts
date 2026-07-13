/// <reference types="hardhat/types/runtime" />

import { types } from "hardhat/config";
import { action } from "../lib/action";

const { removeValidator } = require("../validatorCompound");

action({
  name: "removeValidator",
  chains: [1],
  description:
    "Removes a registered or exited compounding validator from the SSV cluster",
  params: (t) => {
    t.addParam(
      "operatorids",
      "Comma separated operator ids. E.g. 342,343,344,345",
      undefined,
      types.string
    );
    t.addParam(
      "pubkey",
      "The validator's public key in hex format with a 0x prefix",
      undefined,
      types.string
    );
    t.addOptionalParam(
      "consol",
      "Call the consolidation controller instead of the strategy",
      false,
      types.boolean
    );
  },
  run: async ({ signer, args }) => {
    await removeValidator({ ...args, signer });
  },
});
