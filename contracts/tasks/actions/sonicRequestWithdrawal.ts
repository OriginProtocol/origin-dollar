import { types } from "hardhat/config";
import { undelegateValidator } from "../../utils/sonicActions";
import { action } from "../lib/action";

action({
  name: "sonicUndelegate",
  description: "Remove liquidity from a Sonic validator",
  chains: [146],
  params: (t) => {
    t.addOptionalParam(
      "id",
      "Validator identifier. 15, 16, 17 or 18",
      undefined,
      types.int
    );
    t.addOptionalParam(
      "amount",
      "Amount of liquidity to remove",
      undefined,
      types.float
    );
    t.addOptionalParam(
      "buffer",
      "Percentage of total assets to keep as buffer in basis points. 100 = 1%",
      50,
      types.float
    );
  },
  run: async ({ signer, args }) => {
    await undelegateValidator({
      ...args,
      bufferPct: args.buffer,
      signer,
    });
  },
});
