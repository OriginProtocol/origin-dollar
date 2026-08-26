import { claimStrategyRewards } from "../../utils/harvest";
import { action } from "../lib/action";

action({
  name: "harvest",
  description: "Claim strategy rewards through the Safe module",
  chains: [1],
  run: async ({ signer, log }) => {
    log.info("Claiming strategy rewards through the Safe module");
    await claimStrategyRewards(signer);
  },
});
