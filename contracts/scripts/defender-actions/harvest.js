const { ethers } = require("ethers");
const { parseEther, formatUnits } = require("ethers/lib/utils");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");
const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");

const harvesterAbi = require("../../abi/harvester.json");
const nativeStakingStrategyAbi = require("../../abi/native_staking_SSV_strategy.json");

const log = require("../../utils/logger")("action:harvest");

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  // Initialize defender relayer provider and signer
  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fastest" });

  const network = await provider.getNetwork();
  const networkName = network.chainId === 1 ? "mainnet" : "holesky";
  log(`Network: ${networkName} with chain id (${network.chainId})`);

  const harvesterAddress = addresses[networkName].OETHHarvesterSimpleProxy;
  log(`Resolved OETH Harvester Simple address to ${harvesterAddress}`);
  const harvester = new ethers.Contract(harvesterAddress, harvesterAbi, signer);

  const convexAMOProxyAddress = addresses[networkName].ConvexOETHAMOStrategy;

  // Always harvest from Convex AMO
  const strategiesToHarvest = [convexAMOProxyAddress];
  const strategiesDesc = ["Convex AMO"];

  const nativeStakingStrategies = [
    addresses[networkName].NativeStakingSSVStrategyProxy,
    addresses[networkName].NativeStakingSSVStrategy2Proxy,
    addresses[networkName].NativeStakingSSVStrategy3Proxy,
  ];

  for (const strategy of nativeStakingStrategies) {
    log(`Resolved Native Staking Strategy address to ${strategy}`);
    const desc =
      "Native SSV - " +
      (nativeStakingStrategies.indexOf(strategy) + 1).toString();
    const shouldHarvest = await shouldHarvestFromNativeStakingStrategy(
      strategy,
      signer,
      desc
    );

    if (shouldHarvest) {
      // Harvest if there are sufficient rewards to be harvested
      log(`Will harvest from ${strategy}`);
      strategiesToHarvest.push(strategy);
      strategiesDesc.push(desc);
    }
  }

  const tx = await harvester
    .connect(signer)
    ["harvestAndTransfer(address[])"](strategiesToHarvest);
  await logTxDetails(tx, `${strategiesDesc} harvestAndTransfer`);
};

const shouldHarvestFromNativeStakingStrategy = async (
  strategy,
  signer,
  stratDesc
) => {
  const nativeStakingStrategy = new ethers.Contract(
    strategy,
    nativeStakingStrategyAbi,
    signer
  );

  const consensusRewards = await nativeStakingStrategy.consensusRewards();
  log(`Consensus rewards for ${stratDesc}: ${formatUnits(consensusRewards)}`);

  const feeAccumulatorAddress =
    await nativeStakingStrategy.FEE_ACCUMULATOR_ADDRESS();
  const executionRewards = await signer.provider.getBalance(
    feeAccumulatorAddress
  );
  log(`Execution rewards for ${stratDesc}: ${formatUnits(executionRewards)}`);

  return (
    consensusRewards.gt(parseEther("1")) ||
    executionRewards.gt(parseEther("0.5"))
  );
};

module.exports = { handler };
