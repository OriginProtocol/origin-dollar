const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");
const {
  KeyValueStoreClient,
} = require("@openzeppelin/defender-kvstore-client");
const { operateValidators } = require("../../tasks/validator");
const addresses = require("../../utils/addresses");

const nativeStakingStrategyAbi = require("../../abi/native_staking_SSV_strategy.json");
const IWETH9Abi = require("../../abi/IWETH9.json");

const log = require("../../utils/logger")("action:operateValidators");

// Entrypoint for the Defender Action
const handler = async (event) => {
  const store = new KeyValueStoreClient(event);
  // Initialize defender relayer provider and signer
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fastest" });

  const network = await provider.getNetwork();
  const networkName = network.chainId === 1 ? "mainnet" : "holesky";
  log(`Network: ${networkName} with chain id (${network.chainId})`);
  console.log(`Network: ${networkName} with chain id (${network.chainId})`);

  const nativeStakingProxyAddress =
    addresses[networkName].NativeStakingSSVStrategyProxy;
  log(
    `Resolved Native Staking Strategy address to ${nativeStakingProxyAddress}`
  );
  console.log(
    `Resolved Native Staking Strategy address to ${nativeStakingProxyAddress}`
  );
  const nativeStakingStrategy = new ethers.Contract(
    nativeStakingProxyAddress,
    nativeStakingStrategyAbi,
    signer
  );

  const wethAddress = addresses[networkName].WETH;
  log(`Resolved WETH address to ${wethAddress}`);
  console.log(`Resolved WETH address to ${wethAddress}`);
  const WETH = new ethers.Contract(wethAddress, IWETH9Abi, signer);

  const feeAccumulatorAddress =
    await nativeStakingStrategy.FEE_ACCUMULATOR_ADDRESS();

  const contracts = {
    nativeStakingStrategy,
    WETH,
  };

  const p2p_api_key =
    network.chainId === 1
      ? event.secrets.P2P_MAINNET_API_KEY
      : event.secrets.P2P_HOLESKY_API_KEY;
  if (!p2p_api_key) {
    throw new Error(
      "Secret with P2P API key not set. Add the P2P_MAINNET_API_KEY or P2P_HOLESKY_API_KEY secret"
    );
  }
  const p2p_base_url =
    network.chainId === 1 ? "api.p2p.org" : "api-test-holesky.p2p.org";

  const config = {
    feeAccumulatorAddress,
    p2p_api_key,
    p2p_base_url,
    // how much SSV (expressed in days of runway) gets deposited into the
    // SSV Network contract on validator registration. This is calculated
    // at a Cluster level rather than a single validator.
    validatorSpawnOperationalPeriodInDays: 1,
    // Stake the 32 ETH into the validator
    stake: true,
    // Clear the local state of the Defender Action
    clear: true,
  };

  await operateValidators({
    signer,
    contracts,
    store,
    config,
  });
};

module.exports = { handler };