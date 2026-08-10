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
      "pubkeys",
      "Comma-separated validator public keys in hex format with 0x prefixes",
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
    if (!validatorKeys.test(args.pubkeys)) {
      throw new Error(
        "pubkeys must be a comma-separated list of 48-byte hex public keys with 0x prefixes"
      );
    }

    const pubkeys = args.pubkeys.split(",");
    for (const [index, pubkey] of pubkeys.entries()) {
      await removeValidator({
        consol: args.consol,
        index: 2,
        operatorids: NATIVE_STAKING_STRATEGY_2_OPERATOR_IDS,
        pubkey,
        signer,
      });

      if (index < pubkeys.length - 1) {
        await sleep(SSV_API_UPDATE_DELAY_MS);
      }
    }
  },
});
