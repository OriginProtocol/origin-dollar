const { ethers } = require("ethers");
const { parseEther, formatUnits } = require("ethers/lib/utils");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");
const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");

const harvesterAbi = require("../../abi/harvester.json");
const claimRewardsSafeModuleAbi = require("../../abi/claim-rewards-module.json");
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

  if (networkName === "mainnet") {
    await harvestMorphoStrategies(signer);
  }
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

const harvestMorphoStrategies = async (signer) => {
  const strategies = [
    // Morpho Gauntlet Prime USDC
    "0x2b8f37893ee713a4e9ff0ceb79f27539f20a32a1",
    // Morpho Gauntlet Prime USDT
    "0xe3ae7c80a1b02ccd3fb0227773553aeb14e32f26",
    // Meta Morpho Vault
    "0x603CDEAEC82A60E3C4A10dA6ab546459E5f64Fa0",
  ];

  log("Collecting Morpho Strategies rewards");
  for (const strategy of strategies) {
    const distributions = await fetch(
      `https://rewards.morpho.org/v1/users/${strategy}/distributions`
    );
    const distributionsData = await distributions.json();
    for (const data of distributionsData.data) {
      const distributor = data.distributor.address;
      log(`Distributor: ${distributor}`);
      log(`txData: ${data.tx_data}`);

      await signer.sendTransaction({
        to: distributor,
        data: data.tx_data,
        value: 0,
        gasLimit: 1000000,
        speed: "fastest",
      });
    }
  }

  log("Invoking claim from safe module");
  const safeModule = new ethers.Contract(
    addresses.mainnet.ClaimStrategyRewardsSafeModule,
    claimRewardsSafeModuleAbi,
    signer
  );

  const safeModuleTx = await safeModule.connect(signer).claimRewards(true);
  await logTxDetails(safeModuleTx, `claimRewards`);
};

module.exports = { handler };
