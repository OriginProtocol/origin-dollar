import { ethers } from "ethers";
import { subtask, task } from "hardhat/config";
import { configuration } from "../../utils/cctp";
import { keyValueStoreLocalClient } from "../../utils/defender";
import { getNetworkName } from "../../utils/hardhat-helpers";
import { getSigner } from "../../utils/signers";
import { processCctpBridgeTransactions } from "../crossChain";

const log = require("../../utils/logger")("action:crossChainRelay");

subtask(
  "crossChainRelay",
  "Relay CCTP bridge transactions between mainnet and Base"
).setAction(async () => {
  const signer = await getSigner();
  const { chainId } = await signer.provider?.getNetwork();

  let sourceProvider: ethers.providers.JsonRpcProvider;

  if (chainId === 1) {
    if (!process.env.BASE_PROVIDER_URL) {
      throw new Error("BASE_PROVIDER_URL env var required");
    }
    sourceProvider = new ethers.providers.JsonRpcProvider(
      process.env.BASE_PROVIDER_URL
    );
  } else if (chainId === 8453) {
    if (!process.env.PROVIDER_URL) {
      throw new Error("PROVIDER_URL env var required");
    }
    sourceProvider = new ethers.providers.JsonRpcProvider(
      process.env.PROVIDER_URL
    );
  } else {
    throw new Error(`Unsupported chain id: ${chainId}`);
  }

  const networkName = await getNetworkName(sourceProvider);
  const isMainnet = networkName === "mainnet";
  const isBase = networkName === "base";

  let config: any;
  if (isMainnet) {
    config = configuration.mainnetBaseMorpho.mainnet;
  } else if (isBase) {
    config = configuration.mainnetBaseMorpho.base;
  } else {
    throw new Error(`Unsupported network name: ${networkName}`);
  }

  log(`Relaying CCTP from ${networkName}`);
  const store = keyValueStoreLocalClient({
    _storePath: ".store/crossChainRelay.json",
  });

  await processCctpBridgeTransactions({
    destinationChainSigner: signer,
    sourceChainProvider: sourceProvider,
    store,
    networkName,
    blockLookback: config.blockLookback,
    cctpDestinationDomainId: config.cctpDestinationDomainId,
    cctpSourceDomainId: config.cctpSourceDomainId,
    cctpIntegrationContractAddress: config.cctpIntegrationContractAddress,
    cctpIntegrationContractAddressDestination:
      config.cctpIntegrationContractAddressDestination,
  });
});

task("crossChainRelay").setAction(async (_, __, runSuper) => {
  return runSuper();
});
