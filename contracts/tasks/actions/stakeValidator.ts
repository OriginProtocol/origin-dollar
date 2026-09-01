import { types } from "../lib/action";
import { action } from "../lib/action";

const { stakeValidator } = require("../validatorCompound");

action({
  name: "stakeValidator",
  chains: [1],
  description:
    "Converts WETH to ETH and deposits to a validator from the Compounding Staking Strategy",
  params: (t) => {
    t.addParam(
      "pubkey",
      "The validator's public key in hex format with a 0x prefix",
      undefined,
      types.string
    );
    t.addOptionalParam(
      "sig",
      "The validator's deposit signature in hex format with a 0x prefix",
      undefined,
      types.string
    );
    t.addParam(
      "amount",
      "Amount of ETH to deposit to the validator.",
      undefined,
      types.float
    );
    t.addOptionalParam(
      "depositMessageRoot",
      "Deposit message root provided by the validator operator",
      undefined,
      types.string
    );
  },
  run: async ({ signer, args }) => {
    await stakeValidator({ ...args, signer });
  },
});
