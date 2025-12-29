const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");

const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");
const {
  shouldHarvestFromNativeStakingStrategy,
  claimStrategyRewards,
} = require("../../utils/harvest");
const { claimMerklRewards } = require("../../tasks/merkl");

const harvesterAbi = require("../../abi/harvester.json");

const log = require("../../utils/logger")("action:harvest");

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  // Initialize defender relayer provider and signer
  const client = new Defender(event);
  const provider = client.relaySigner.getProvider({ ethersVersion: "v5" });
  const signer = await client.relaySigner.getSigner(provider, {
    speed: "fastest",
    ethersVersion: "v5",
  });

  const { chainId } = await provider.getNetwork();
  if (chainId !== 1) {
    throw new Error(
      `Action should only be run on mainnet, not on network with chainId ${chainId}`
    );
  }

  const harvesterAddress = addresses.mainnet.OETHHarvesterSimpleProxy;
  log(`Resolved OETH Harvester Simple address to ${harvesterAddress}`);
  const harvester = new ethers.Contract(harvesterAddress, harvesterAbi, signer);

  const nativeStakingStrategies = [
    // addresses[networkName].NativeStakingSSVStrategyProxy,
    addresses.mainnet.NativeStakingSSVStrategy2Proxy,
    addresses.mainnet.NativeStakingSSVStrategy3Proxy,
  ];

  const strategiesToHarvest = [];
  for (const strategy of nativeStakingStrategies) {
    log(`Resolved Native Staking Strategy address to ${strategy}`);
    const shouldHarvest = await shouldHarvestFromNativeStakingStrategy(
      strategy,
      signer
    );

    if (shouldHarvest) {
      // Harvest if there are sufficient rewards to be harvested
      log(`Will harvest from ${strategy}`);
      strategiesToHarvest.push(strategy);
    }
  }

  if (strategiesToHarvest.length > 0) {
    const tx = await harvester
      .connect(signer)
      ["harvestAndTransfer(address[])"](strategiesToHarvest);
    await logTxDetails(tx, `harvestAndTransfer`);
  } else {
    log("No native staking strategies require harvesting at this time");
  }

  // Claim MORPHO rewards to the Morpho OUSD v2 Strategy
  await claimMerklRewards(addresses.mainnet.MorphoOUSDv2StrategyProxy, signer);
  // Collect the CRV and MORPHO rewards from the strategies using the Safe module
  await claimStrategyRewards(signer);
};

module.exports = { handler };
