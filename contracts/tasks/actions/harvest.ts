import { ethers } from "ethers";
import addresses from "../../utils/addresses";
import {
  claimStrategyRewards,
  shouldHarvestFromNativeStakingStrategy,
} from "../../utils/harvest";
import { logTxDetails } from "../../utils/txLogger";
import { action } from "../lib/action";
import { claimMerklRewards } from "../merkl";

const harvesterAbi = require("../../abi/harvester.json");

action({
  name: "harvest",
  description: "Harvest and swap rewards from native staking strategies",
  chains: [1],
  run: async ({ signer, log }) => {
    const harvesterAddress = addresses.mainnet.OETHHarvesterSimpleProxy;
    log.info(`Resolved OETH Harvester Simple address to ${harvesterAddress}`);
    const harvester = new ethers.Contract(
      harvesterAddress,
      harvesterAbi,
      signer
    );

    const nativeStakingStrategies = [
      addresses.mainnet.NativeStakingSSVStrategy2Proxy,
      addresses.mainnet.NativeStakingSSVStrategy3Proxy,
    ];

    const strategiesToHarvest: string[] = [];
    for (const strategy of nativeStakingStrategies) {
      log.info(`Checking strategy ${strategy}`);
      const shouldHarvest = await shouldHarvestFromNativeStakingStrategy(
        strategy,
        signer
      );
      if (shouldHarvest) {
        log.info(`Will harvest from ${strategy}`);
        strategiesToHarvest.push(strategy);
      }
    }

    if (strategiesToHarvest.length > 0) {
      const connection = harvester.connect(signer);
      const tx = await connection["harvestAndTransfer(address[])"](
        strategiesToHarvest
      );
      await logTxDetails(tx, "harvestAndTransfer");
    } else {
      log.info("No native staking strategies require harvesting at this time");
    }

    await claimMerklRewards(
      addresses.mainnet.MorphoOUSDv2StrategyProxy,
      signer
    );
    await claimStrategyRewards(signer);
  },
});
