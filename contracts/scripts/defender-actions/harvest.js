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

  const harvesterAddress = addresses[networkName].OETHHarvesterProxy;
  log(`Resolved OETH Harvester address to ${harvesterAddress}`);
  const harvester = new ethers.Contract(harvesterAddress, harvesterAbi, signer);

  const firstNativeStakingProxyAddress =
    addresses[networkName].NativeStakingSSVStrategyProxy;
  log(
    `Resolved first Native Staking Strategy address to ${firstNativeStakingProxyAddress}`
  );
  await harvest(harvester, firstNativeStakingProxyAddress, signer, "first");

  const secondNativeStakingProxyAddress =
    addresses[networkName].NativeStakingSSVStrategy2Proxy;
  log(
    `Resolved second Native Staking Strategy address to ${secondNativeStakingProxyAddress}`
  );
  await harvest(harvester, secondNativeStakingProxyAddress, signer, "second");

  const thirdNativeStakingProxyAddress =
    addresses[networkName].NativeStakingSSVStrategy3Proxy;
  log(
    `Resolved third Native Staking Strategy address to ${thirdNativeStakingProxyAddress}`
  );
  await harvest(harvester, thirdNativeStakingProxyAddress, signer, "third");
};

const harvest = async (
  harvester,
  nativeStakingProxyAddress,
  signer,
  stratDesc
) => {
  const nativeStakingStrategy = new ethers.Contract(
    nativeStakingProxyAddress,
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

  if (
    consensusRewards.gt(parseEther("1")) ||
    executionRewards.gt(parseEther("0.5"))
  ) {
    const tx1 = await harvester
      .connect(signer)
      .harvestAndSwap(nativeStakingProxyAddress);
    await logTxDetails(tx1, `${stratDesc} harvestAndSwap`);
  } else {
    log(
      `Skipping ${stratDesc} harvestAndSwap due to low consensus and execution rewards`
    );
  }
};

module.exports = { handler };
