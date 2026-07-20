import { action } from "../lib/action";
import { getContract } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

const MODULE_DEPLOYMENTS = [
  "CollectXOGNRewardsModule1",
  "CollectXOGNRewardsModule2",
  "CollectXOGNRewardsModule3",
  "CollectXOGNRewardsModule4",
  "CollectXOGNRewardsModule5",
  "CollectXOGNRewardsModule6",
] as const;

action({
  name: "ognClaimAndForwardRewards",
  description: "Claim and forward OGN rewards from all modules",
  chains: [1],
  run: async ({ signer, log }) => {
    for (const deploymentName of MODULE_DEPLOYMENTS) {
      const module = await getContract(deploymentName);
      log.info(
        `Calling collectRewards on ${deploymentName} at ${module.address}`
      );
      const tx = await module.connect(signer).collectRewards({
        gasLimit: 500000,
      });
      await logTxDetails(tx, `collectRewards on ${deploymentName}`);
    }
  },
});
