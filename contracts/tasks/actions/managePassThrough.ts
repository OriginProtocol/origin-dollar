import { transferTokens } from "../../utils/managePassThrough";
import { action } from "../lib/action";

action({
  name: "managePassThrough",
  description: "Transfer tokens via pass-through mechanism",
  chains: [1],
  run: async ({ signer }) => {
    await transferTokens({ signer });
  },
});
