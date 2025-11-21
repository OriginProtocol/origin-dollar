const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const { registerValidators } = require("../../utils/validator");
const addresses = require("../../utils/addresses");

const nativeStakingStrategyAbi = require("../../abi/native_staking_SSV_strategy.json");
const IWETH9Abi = require("../../abi/IWETH9.json");

const log = require("../../utils/logger")("action:registerValidators");

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
  const store = client.keyValueStore;

  const network = await provider.getNetwork();
  const networkName = network.chainId === 1 ? "mainnet" : "hoodi";
  log(`Network: ${networkName} with chain id (${network.chainId})`);

  const nativeStakingProxyAddress =
    addresses[networkName].NativeStakingSSVStrategy3Proxy;
  log(
    `Resolved Native Staking Strategy address to ${nativeStakingProxyAddress}`
  );
  const nativeStakingStrategy = new ethers.Contract(
    nativeStakingProxyAddress,
    nativeStakingStrategyAbi,
    signer
  );

  const wethAddress = addresses[networkName].WETH;
  log(`Resolved WETH address to ${wethAddress}`);
  const WETH = new ethers.Contract(wethAddress, IWETH9Abi, signer);

  const feeAccumulatorAddress =
    await nativeStakingStrategy.FEE_ACCUMULATOR_ADDRESS();

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

  const awsS3AccessKeyId = event.secrets.AWS_ACCESS_S3_KEY_ID;
  const awsS3SexcretAccessKeyId = event.secrets.AWS_SECRET_S3_ACCESS_KEY;
  const s3BucketName = event.secrets.VALIDATOR_KEYS_S3_BUCKET_NAME;

  if (!awsS3AccessKeyId) {
    throw new Error("Secret AWS_ACCESS_S3_KEY_ID not set");
  }
  if (!awsS3SexcretAccessKeyId) {
    throw new Error("Secret AWS_SECRET_S3_ACCESS_KEY not set");
  }
  if (!s3BucketName) {
    throw new Error("Secret VALIDATOR_KEYS_S3_BUCKET_NAME not set");
  }

  await registerValidators({
    signer,
    store,
    nativeStakingStrategy,
    WETH,
    feeAccumulatorAddress,
    p2p_api_key,
    p2p_base_url,
    // how much SSV (expressed in days of runway) gets deposited into the
    // SSV Network contract on validator registration. This is calculated
    // at a Cluster level rather than a single validator.
    validatorSpawnOperationalPeriodInDays: 1,
    // this overrides validatorSpawnOperationalPeriodInDays
    ssvAmount: 0,
    clear: true,
    // maxValidatorsToRegister: 1,
    awsS3AccessKeyId,
    awsS3SexcretAccessKeyId,
    s3BucketName,
  });
};

module.exports = { handler };
