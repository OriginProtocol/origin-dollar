import { ethers } from "ethers";
import { types } from "hardhat/config";
import { configuration } from "../../utils/cctp";
import { keyValueStoreLocalClient } from "../../utils/defender";
import { getNetworkName } from "../../utils/hardhat-helpers";
import { processCctpBridgeTransactions } from "../crossChain";
import { action } from "../lib/action";

action({
  name: "crossChainRelay",
  description: "Relay CCTP bridge transactions between mainnet and Base",
  chains: [1, 8453],
  params: (t) => {
    t.addOptionalParam(
      "txHash",
      "Source-chain tx hash to relay. When set, skips the recent-events scan and relays only this transaction's message(s). Must be run on the destination chain.",
      undefined,
      types.string
    );
  },
  run: async ({ signer, chainId, log, args }) => {
    let sourceProvider: ethers.providers.JsonRpcProvider;

    if (chainId === 1) {
      if (!process.env.BASE_PROVIDER_URL) {
        throw new Error("BASE_PROVIDER_URL env var required");
      }
      sourceProvider = new ethers.providers.JsonRpcProvider(
        process.env.BASE_PROVIDER_URL
      );
    } else {
      if (!process.env.PROVIDER_URL) {
        throw new Error("PROVIDER_URL env var required");
      }
      sourceProvider = new ethers.providers.JsonRpcProvider(
        process.env.PROVIDER_URL
      );
    }

    const networkName = await getNetworkName(sourceProvider);

    let config: any;
    if (networkName === "mainnet") {
      config = configuration.mainnetBaseMorpho.mainnet;
    } else if (networkName === "base") {
      config = configuration.mainnetBaseMorpho.base;
    } else {
      throw new Error(`Unsupported source network: ${networkName}`);
    }

    log.info(`Relaying CCTP from ${networkName}`);
    const store = keyValueStoreLocalClient({
      _storePath: ".store/crossChainRelay.json",
    });

    await processCctpBridgeTransactions({
      txHash: args.txHash,
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
  },
});
