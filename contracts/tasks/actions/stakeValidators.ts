import { ethers } from "ethers";
import { subtask, task, types } from "hardhat/config";
import addresses from "../../utils/addresses";
import { keyValueStoreLocalClient } from "../../utils/defender";
import { getSigner } from "../../utils/signers";
import { stakeValidators } from "../../utils/validator";

const nativeStakingStrategyAbi = require("../../abi/native_staking_SSV_strategy.json");
const IWETH9Abi = require("../../abi/IWETH9.json");
const log = require("../../utils/logger")("action:stakeValidators");

subtask(
  "stakeValidators",
  "Creates the required amount of new SSV validators and stakes ETH"
)
  .addOptionalParam(
    "uuid",
    "uuid of P2P's request SSV validator API call",
    undefined,
    types.string
  )
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .setAction(async (taskArgs: any) => {
    const signer = await getSigner();
    const { chainId } = await signer.provider?.getNetwork();
    const networkName = chainId === 1 ? "mainnet" : "holesky";
    log(`Network: ${networkName} (${chainId})`);

    const store = keyValueStoreLocalClient({
      _storePath: ".store/stakeValidators.json",
    });

    const nativeStakingProxyAddress = (addresses as any)[networkName]
      .NativeStakingSSVStrategy3Proxy;
    log(`NativeStakingStrategy: ${nativeStakingProxyAddress}`);
    const nativeStakingStrategy = new ethers.Contract(
      nativeStakingProxyAddress,
      nativeStakingStrategyAbi,
      signer
    );

    const wethAddress = (addresses as any)[networkName].WETH;
    log(`WETH: ${wethAddress}`);
    const WETH = new ethers.Contract(wethAddress, IWETH9Abi, signer);

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
    const awsS3SexcretAccessKeyId = process.env.AWS_SECRET_S3_ACCESS_KEY;
    const s3BucketName = process.env.VALIDATOR_KEYS_S3_BUCKET_NAME;

    if (!awsS3AccessKeyId) throw new Error("AWS_ACCESS_S3_KEY_ID not set");
    if (!awsS3SexcretAccessKeyId)
      throw new Error("AWS_SECRET_S3_ACCESS_KEY not set");
    if (!s3BucketName) throw new Error("VALIDATOR_KEYS_S3_BUCKET_NAME not set");

    await stakeValidators({
      signer,
      store,
      nativeStakingStrategy,
      WETH,
      p2p_api_key,
      p2p_base_url,
      uuid: taskArgs.uuid,
      awsS3AccessKeyId,
      awsS3SexcretAccessKeyId,
      s3BucketName,
    });
  });

task("stakeValidators").setAction(async (_, __, runSuper) => {
  return runSuper();
});
