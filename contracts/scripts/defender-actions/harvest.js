const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");
const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");

const harvesterAbi = require("../../abi/harvester.json");

const log = require("../../utils/logger")("action:doAccounting");

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

  const secondNativeStakingProxyAddress =
    addresses[networkName].NativeStakingSSVStrategy2Proxy;
  log(
    `Resolved second Native Staking Strategy address to ${secondNativeStakingProxyAddress}`
  );

  const tx1 = await harvester
    .connect(signer)
    .harvestAndSwap(firstNativeStakingProxyAddress);
  await logTxDetails(tx1, "first harvestAndSwap");

  // const tx2 = await harvester
  //   .connect(signer)
  //   .harvestAndSwap(secondNativeStakingProxyAddress);
  // await logTxDetails(tx2, "second harvestAndSwap");
};

module.exports = { handler };
