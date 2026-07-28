import { ethers } from "ethers";
import { configuration } from "../../utils/cctp";
import { keyValueStoreLocalClient } from "../../utils/localKeyValueStore";
import { processCctpBridgeTransactions } from "../crossChain";
import { action, types } from "../lib/action";
import { CHAIN_NAMES } from "../lib/network";

action({
  name: "crossChainRelayHyperEVM",
  description: "Relay CCTP bridge transactions between mainnet and HyperEVM",
  chains: [1, 999],
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
      if (!process.env.HYPEREVM_PROVIDER_URL) {
        throw new Error("HYPEREVM_PROVIDER_URL env var required");
      }
      sourceProvider = new ethers.providers.JsonRpcProvider(
        process.env.HYPEREVM_PROVIDER_URL
      );
    } else {
      if (!process.env.PROVIDER_URL) {
        throw new Error("PROVIDER_URL env var required");
      }
      sourceProvider = new ethers.providers.JsonRpcProvider(
        process.env.PROVIDER_URL
      );
    }

    const { chainId: sourceChainId } = await sourceProvider.getNetwork();
    const networkName = CHAIN_NAMES[sourceChainId];

    let config: any;
    if (networkName === "mainnet") {
      config = configuration.mainnetHyperEVMMorpho.mainnet;
    } else if (networkName === "hyperevm") {
      config = configuration.mainnetHyperEVMMorpho.hyperevm;
    } else {
      throw new Error(`Unsupported source network: ${networkName}`);
    }

    log.info(`Relaying CCTP from ${networkName}`);
    const store = keyValueStoreLocalClient({
      _storePath: ".store/crossChainRelayHyperEVM.json",
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
