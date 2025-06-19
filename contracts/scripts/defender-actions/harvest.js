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

const labelsSSV = {
  [addresses.mainnet.NativeStakingSSVStrategyProxy]: "Staking Strategy 1",
  [addresses.mainnet.NativeStakingSSVStrategy2Proxy]: "Staking Strategy 2",
  [addresses.mainnet.NativeStakingSSVStrategy3Proxy]: "Staking Strategy 3",
  [addresses.holesky.NativeStakingSSVStrategyProxy]:
    "Staking Strategy 1 Holesky",
};

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

  const nativeStakingStrategies = [
    // addresses[networkName].NativeStakingSSVStrategyProxy,
    addresses[networkName].NativeStakingSSVStrategy2Proxy,
    addresses[networkName].NativeStakingSSVStrategy3Proxy,
  ];

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
};

const shouldHarvestFromNativeStakingStrategy = async (strategy, signer) => {
  const nativeStakingStrategy = new ethers.Contract(
    strategy,
    nativeStakingStrategyAbi,
    signer
  );

  const consensusRewards = await nativeStakingStrategy.consensusRewards();
  log(
    `Consensus rewards for ${labelsSSV[strategy]}: ${formatUnits(
      consensusRewards
    )}`
  );

  const feeAccumulatorAddress =
    await nativeStakingStrategy.FEE_ACCUMULATOR_ADDRESS();
  const executionRewards = await signer.provider.getBalance(
    feeAccumulatorAddress
  );
  log(
    `Execution rewards for ${labelsSSV[strategy]}: ${formatUnits(
      executionRewards
    )}`
  );

  return (
    consensusRewards.gt(parseEther("1")) ||
    executionRewards.gt(parseEther("0.5"))
  );
};

module.exports = { handler };
