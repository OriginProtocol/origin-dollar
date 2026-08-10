/// <reference types="hardhat/types/runtime" />

import { types } from "../lib/action";
import { action } from "../lib/action";

const { validatorKeys } = require("../../utils/regex");
const { sleep } = require("../../utils/time");
const { removeValidator } = require("../ssv");
const NATIVE_STAKING_STRATEGY_2_OPERATOR_IDS = "752,753,754,755";
const SSV_API_UPDATE_DELAY_MS = 30_000;

action({
  name: "removeValidator",
  chains: [1],
  description:
    "Removes registered or exited validators from Native Staking Strategy 2",
  params: (t) => {
    t.addParam(
      "pubkey",
      "One or more comma-separated validator public keys in hex format with 0x prefixes",
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
  run: async ({ signer, chainId, args }) => {
    if (!validatorKeys.test(args.pubkey)) {
      throw new Error(
        "pubkey must contain one or more comma-separated 48-byte hex public keys with 0x prefixes"
      );
    }

    const pubkeys = args.pubkey.split(",");
    for (const [index, pubkey] of pubkeys.entries()) {
      await removeValidator({
        consol: args.consol,
        index: 2,
        operatorids: NATIVE_STAKING_STRATEGY_2_OPERATOR_IDS,
        pubkey,
        chainId,
        signer,
      });

      if (index < pubkeys.length - 1) {
        await sleep(SSV_API_UPDATE_DELAY_MS);
      }
    }
  },
});
