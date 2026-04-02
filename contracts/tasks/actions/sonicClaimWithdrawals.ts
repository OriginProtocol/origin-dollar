import { withdrawFromSFC } from "../../utils/sonicActions";
import { action } from "../lib/action";

action({
  name: "sonicClaimWithdrawals",
  description: "Withdraw native S from a previously undelegated validator",
  chains: [146],
  run: async ({ signer }) => {
    await withdrawFromSFC({ signer });
  },
});
