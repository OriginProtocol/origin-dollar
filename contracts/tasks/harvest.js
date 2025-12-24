const { parseEther, formatUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { resolveContract } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");

const claimRewardsSafeModuleAbi = require("../../abi/claim-rewards-module.json");
const nativeStakingStrategyAbi = require("../../abi/native_staking_SSV_strategy.json");

const log = require("../utils/logger")("task:harvest");

const labelsSSV = {
  [addresses.mainnet.NativeStakingSSVStrategyProxy]: "Staking Strategy 1",
  [addresses.mainnet.NativeStakingSSVStrategy2Proxy]: "Staking Strategy 2",
  [addresses.mainnet.NativeStakingSSVStrategy3Proxy]: "Staking Strategy 3",
  [addresses.holesky.NativeStakingSSVStrategyProxy]:
    "Staking Strategy 1 Holesky",
};

async function harvestAndSwap({ strategy, harvester }) {
  const signer = await getSigner();

  const harvesterContract = await resolveContract(harvester, "OETHHarvester");
  const strategyContract = await resolveContract(strategy);

  log(`Harvesting and swapping for strategy ${strategyContract.address}`);
  const tx = await harvesterContract.connect(signer)[
    // eslint-disable-next-line no-unexpected-multiline
    "harvestAndSwap(address)"
  ](strategyContract.address);
  await logTxDetails(tx, "harvestAndSwap");
}

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
};

const harvestCurveStrategies = async (signer) => {
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
  harvestAndSwap,
  harvestMorphoStrategies,
  harvestCurveStrategies,
  shouldHarvestFromNativeStakingStrategy,
};
