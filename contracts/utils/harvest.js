const ethers = require("ethers");
const { parseEther, formatUnits } = require("ethers/lib/utils");

const addresses = require("./addresses");
const { logTxDetails } = require("./txLogger");

const claimRewardsSafeModuleAbi = require("../abi/claim-rewards-module.json");
const nativeStakingStrategyAbi = require("../abi/native_staking_SSV_strategy.json");

const log = require("./logger")("task:harvest");

const labelsSSV = {
  [addresses.mainnet.NativeStakingSSVStrategyProxy]: "Staking Strategy 1",
  [addresses.mainnet.NativeStakingSSVStrategy2Proxy]: "Staking Strategy 2",
  [addresses.mainnet.NativeStakingSSVStrategy3Proxy]: "Staking Strategy 3",
  [addresses.holesky.NativeStakingSSVStrategyProxy]:
    "Staking Strategy 1 Holesky",
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
    // Morpho OUSD v2 Strategy
    "0x3643cafa6ef3dd7fcc2adad1cabf708075afff6e",
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
};

const claimStrategyRewards = async (signer) => {
  log("Invoking claim from safe module");
  const safeModule = new ethers.Contract(
    addresses.mainnet.ClaimStrategyRewardsSafeModule,
    claimRewardsSafeModuleAbi,
    signer
  );

  const safeModuleTx = await safeModule.connect(signer).claimRewards(true, {
    gasLimit: 2500000,
  });
  await logTxDetails(safeModuleTx, `claimRewards`);
};

module.exports = {
  harvestMorphoStrategies,
  claimStrategyRewards,
  shouldHarvestFromNativeStakingStrategy,
};
