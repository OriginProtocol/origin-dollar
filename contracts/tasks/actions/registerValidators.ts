import { ethers } from "ethers";
import { types } from "hardhat/config";
import addresses from "../../utils/addresses";
import { keyValueStoreLocalClient } from "../../utils/defender";
import { registerValidators } from "../../utils/validator";
import { action } from "../lib/action";

const nativeStakingStrategyAbi = require("../../abi/native_staking_SSV_strategy.json");
const IWETH9Abi = require("../../abi/IWETH9.json");

action({
  name: "registerValidators",
  description:
    "Creates the required amount of new SSV validators and stakes ETH",
  chains: [1, 560048],
  params: (t) => {
    t.addOptionalParam(
      "days",
      "SSV Cluster operational time in days",
      2,
      types.int
    );
    t.addOptionalParam(
      "validators",
      "The number of validators to register. defaults to the max that can be registered",
      undefined,
      types.int
    );
    t.addOptionalParam("clear", "Clear storage", false, types.boolean);
    t.addOptionalParam(
      "eth",
      "Override the days option and set the amount of ETH to deposit to the cluster.",
      undefined,
      types.float
    );
    t.addOptionalParam(
      "uuid",
      "uuid of P2P's request SSV validator API call.",
      undefined,
      types.string
    );
    t.addOptionalParam(
      "index",
      "The number of the Native Staking Contract deployed.",
      undefined,
      types.int
    );
  },
  run: async ({ signer, chainId, networkName, log, args }) => {
    const store = keyValueStoreLocalClient({
      _storePath: ".store/registerValidators.json",
    });

    const nativeStakingProxyAddress = (addresses as any)[networkName]
      .NativeStakingSSVStrategy3Proxy;
    log.info(`NativeStakingStrategy: ${nativeStakingProxyAddress}`);
    const nativeStakingStrategy = new ethers.Contract(
      nativeStakingProxyAddress,
      nativeStakingStrategyAbi,
      signer
    );

    const wethAddress = (addresses as any)[networkName].WETH;
    log.info(`WETH: ${wethAddress}`);
    const WETH = new ethers.Contract(wethAddress, IWETH9Abi, signer);

    const feeAccumulatorAddress =
      await nativeStakingStrategy.FEE_ACCUMULATOR_ADDRESS();

    const p2p_api_key =
      chainId === 1
        ? process.env.P2P_MAINNET_API_KEY
        : process.env.P2P_HOLESKY_API_KEY;
    if (!p2p_api_key) {
      throw new Error(
        "Secret with P2P API key not set. Add P2P_MAINNET_API_KEY or P2P_HOLESKY_API_KEY"
      );
    }
    const p2p_base_url =
      chainId === 1 ? "api.p2p.org" : "api-test-holesky.p2p.org";

    const awsS3AccessKeyId = process.env.AWS_ACCESS_S3_KEY_ID;
    const awsS3SecretAccessKeyId = process.env.AWS_SECRET_S3_ACCESS_KEY;
    const s3BucketName = process.env.VALIDATOR_KEYS_S3_BUCKET_NAME;

    if (!awsS3AccessKeyId) throw new Error("AWS_ACCESS_S3_KEY_ID not set");
    if (!awsS3SecretAccessKeyId)
      throw new Error("AWS_SECRET_S3_ACCESS_KEY not set");
    if (!s3BucketName) throw new Error("VALIDATOR_KEYS_S3_BUCKET_NAME not set");

    await registerValidators({
      signer,
      store,
      nativeStakingStrategy,
      WETH,
      feeAccumulatorAddress,
      p2p_api_key,
      p2p_base_url,
      validatorSpawnOperationalPeriodInDays: args.days,
      clear: args.clear,
      uuid: args.uuid,
      maxValidatorsToRegister: args.validators,
      ethAmount: args.eth,
      awsS3AccessKeyId,
      awsS3SecretAccessKeyId,
      s3BucketName,
    });
  },
});
