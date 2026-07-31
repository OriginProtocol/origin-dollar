import { types, action } from "../lib/action";

const { verifyBalances } = require("../beacon");
const { cleanStateCache } = require("../../utils/beacon");

action({
  name: "verifyBalances",
  chains: [1],
  description: "Verify validator balances on the Beacon chain",
  params: (t) => {
    t.addOptionalParam(
      "slot",
      "The slot snapBalances was executed. Default: last balances snapshot",
      undefined,
      types.int
    );
    t.addOptionalParam(
      "indexes",
      "Comma separated list of validator indexes. Default: strategy's active validators",
      undefined,
      types.string
    );
    t.addOptionalParam(
      "deposits",
      "Comma separated list of indexes to beacon chain pending deposits used for generating unit test data",
      undefined,
      types.string
    );
    t.addOptionalParam(
      "dryrun",
      "Do not call verifyBalances on the strategy contract. Just log the params including the proofs",
      false,
      types.boolean
    );
    t.addOptionalParam(
      "test",
      "Used for generating unit test data.",
      false,
      types.boolean
    );
    t.addOptionalParam(
      "overIds",
      "A comma separated list of validator IDs to override balances.",
      "",
      types.string
    );
    t.addOptionalParam(
      "overBals",
      "A comma separated list of validator balances to override in Gwei.",
      "",
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
    await verifyBalances({ ...args, signer });
    cleanStateCache();
  },
});
