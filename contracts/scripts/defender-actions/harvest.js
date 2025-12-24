const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");

const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");
const {
  // harvestMorphoStrategies,
  shouldHarvestFromNativeStakingStrategy,
  harvestCurveStrategies,
} = require("../../tasks/harvest");

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

  const tx = await harvester
    .connect(signer)
    ["harvestAndTransfer(address[])"](strategiesToHarvest);
  await logTxDetails(tx, `harvestAndTransfer`);

  // await harvestMorphoStrategies(signer);
  await harvestCurveStrategies(signer);
};

module.exports = { handler };
