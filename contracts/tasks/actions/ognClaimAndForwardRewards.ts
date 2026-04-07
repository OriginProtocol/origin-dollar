/// <reference types="hardhat/types/runtime" />

import { action } from "../lib/action";
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
    const ethers = hre.ethers;

    for (const deploymentName of MODULE_DEPLOYMENTS) {
      const module = await ethers.getContract(deploymentName);
      log.info(
        `Calling claimAndForward on ${deploymentName} at ${module.address}`
      );
      const tx = await module.connect(signer).claimAndForward({
        gasLimit: 500000,
      });
      await logTxDetails(tx, `claimAndForward on ${deploymentName}`);
    }
  },
});
