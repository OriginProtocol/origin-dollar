import { ethers } from "ethers";
import { types } from "../lib/action";
import addresses from "../../utils/addresses";
import { keyValueStoreLocalClient } from "../../utils/defender";
import { stakeValidators } from "../../utils/validator";
import { action } from "../lib/action";

const nativeStakingStrategyAbi = require("../../abi/native_staking_SSV_strategy.json");
const IWETH9Abi = require("../../abi/IWETH9.json");

action({
  name: "stakeValidators",
  description:
    "Creates the required amount of new SSV validators and stakes ETH",
  chains: [1, 17000],
  params: (t) => {
    t.addOptionalParam(
      "uuid",
      "uuid of P2P's request SSV validator API call",
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
      _storePath: ".store/stakeValidators.json",
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
      uuid: args.uuid,
      awsS3AccessKeyId,
      awsS3SexcretAccessKeyId,
      s3BucketName,
    });
  },
});
