import { action, types } from "../lib/action";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fundWithdrawals } = require("../autoWithdrawal");

action({
  name: "otokenOusdAutoWithdrawal",
  description: "Auto-process OUSD withdrawals via the AutoWithdrawalModule",
  chains: [1],
  params: (t) => {
    t.addOptionalParam(
      "gasLimit",
      "Gas limit to use when calling fundWithdrawals",
      4000000,
      types.int
    );
    t.addOptionalParam(
      "module",
      "Address of the AutoWithdrawalModule. Defaults to the deployed AutoWithdrawalModule",
      undefined,
      types.string
    );
  },
  run: async ({ args }) => {
    await fundWithdrawals(args);
  },
});
