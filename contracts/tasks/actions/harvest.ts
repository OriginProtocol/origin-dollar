import { ethers } from "ethers";
import { subtask, task } from "hardhat/config";

import addresses from "../../utils/addresses";
import {
  claimStrategyRewards,
  shouldHarvestFromNativeStakingStrategy,
} from "../../utils/harvest";
import { getSigner } from "../../utils/signers";
import { logTxDetails } from "../../utils/txLogger";
import { claimMerklRewards } from "../merkl";

const harvesterAbi = require("../../abi/harvester.json");
const log = require("../../utils/logger")("action:harvest");

subtask(
  "harvest",
  "Harvest and swap rewards from native staking strategies"
).setAction(async () => {
  const signer = await getSigner();
  const { chainId } = await signer.provider?.getNetwork();
  if (chainId !== 1) {
    throw new Error(
      `Action should only be run on mainnet, not chainId ${chainId}`
    );
  }

  const harvesterAddress = addresses.mainnet.OETHHarvesterSimpleProxy;
  log(`Resolved OETH Harvester Simple address to ${harvesterAddress}`);
  const harvester = new ethers.Contract(harvesterAddress, harvesterAbi, signer);

  const nativeStakingStrategies = [
    addresses.mainnet.NativeStakingSSVStrategy2Proxy,
    addresses.mainnet.NativeStakingSSVStrategy3Proxy,
  ];

  const strategiesToHarvest: string[] = [];
  for (const strategy of nativeStakingStrategies) {
    log(`Checking strategy ${strategy}`);
    const shouldHarvest = await shouldHarvestFromNativeStakingStrategy(
      strategy,
      signer
    );
    if (shouldHarvest) {
      log(`Will harvest from ${strategy}`);
      strategiesToHarvest.push(strategy);
    }
  }

  if (strategiesToHarvest.length > 0) {
    const tx = await harvester
      .connect(signer)
      ["harvestAndTransfer(address[])"](strategiesToHarvest);
    await logTxDetails(tx, "harvestAndTransfer");
  } else {
    log("No native staking strategies require harvesting at this time");
  }

  await claimMerklRewards(addresses.mainnet.MorphoOUSDv2StrategyProxy, signer);
  await claimStrategyRewards(signer);
});

task("harvest").setAction(async (_, __, runSuper) => {
  return runSuper();
});
