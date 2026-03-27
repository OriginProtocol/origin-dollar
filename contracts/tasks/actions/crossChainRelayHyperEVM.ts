import { ethers } from "ethers";
import { subtask, task } from "hardhat/config";
import { configuration } from "../../utils/cctp";
import { keyValueStoreLocalClient } from "../../utils/defender";
import { getNetworkName } from "../../utils/hardhat-helpers";
import { getSigner } from "../../utils/signers";
import { processCctpBridgeTransactions } from "../crossChain";

const log = require("../../utils/logger")("action:crossChainRelayHyperEVM");

subtask(
  "crossChainRelayHyperEVM",
  "Relay CCTP bridge transactions between mainnet and HyperEVM"
).setAction(async () => {
  const signer = await getSigner();
  const { chainId } = await signer.provider?.getNetwork();

  let sourceProvider: ethers.providers.JsonRpcProvider;

  if (chainId === 1) {
    if (!process.env.HYPEREVM_PROVIDER_URL) {
      throw new Error("HYPEREVM_PROVIDER_URL env var required");
    }
    sourceProvider = new ethers.providers.JsonRpcProvider(
      process.env.HYPEREVM_PROVIDER_URL
    );
  } else if (chainId === 999) {
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
  const isHyperEVM = networkName === "hyperevm";

  let config: any;
  if (isMainnet) {
    config = configuration.mainnetHyperEVMMorpho.mainnet;
  } else if (isHyperEVM) {
    config = configuration.mainnetHyperEVMMorpho.hyperevm;
  } else {
    throw new Error(`Unsupported network name: ${networkName}`);
  }

  log(`Relaying CCTP from ${networkName}`);
  const store = keyValueStoreLocalClient({
    _storePath: ".store/crossChainRelayHyperEVM.json",
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

task("crossChainRelayHyperEVM").setAction(async (_, __, runSuper) => {
  return runSuper();
});
