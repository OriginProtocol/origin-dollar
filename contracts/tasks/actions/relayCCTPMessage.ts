import path from "path";
import { ethers } from "ethers";
import { configuration } from "../../utils/cctp";
import { keyValueStoreLocalClient } from "../../utils/localKeyValueStore";
import { processCctpBridgeTransactions } from "../crossChain";
import { action, types } from "../lib/action";

action({
  name: "relayCCTPMessage",
  description:
    "Fetches CCTP attested Messages via Circle Gateway API and relays it to the integrator contract",
  chains: [1, 8453],
  params: (t) => {
    t.addOptionalParam(
      "txHash",
      "Source-chain tx hash to relay. When set, skips the recent-events scan and relays only this transaction's message(s). Must be run on the destination chain.",
      undefined,
      types.string
    );
    t.addOptionalParam(
      "block",
      "Override the block number at which the message emission transaction happened",
      undefined,
      types.int
    );
    t.addOptionalParam(
      "dryrun",
      "Do not call verifyBalances on the strategy contract. Just log the params including the proofs",
      false,
      types.boolean
    );
  },
  run: async ({ signer, chainId, args }) => {
    // The signer is on the destination chain. The source chain is the other
    // side of the pair, so build its provider from env vars.
    let config;
    let sourceChainProvider: ethers.providers.JsonRpcProvider;
    let sourceNetworkName: "mainnet" | "base";

    if (chainId === 1) {
      // destination = Ethereum, source = Base
      config = configuration.mainnetBaseMorpho.base;
      sourceNetworkName = "base";
      if (!process.env.BASE_PROVIDER_URL) {
        throw new Error("BASE_PROVIDER_URL env var required");
      }
      sourceChainProvider = new ethers.providers.JsonRpcProvider(
        process.env.BASE_PROVIDER_URL
      );
    } else if (chainId === 8453) {
      // destination = Base, source = Ethereum
      config = configuration.mainnetBaseMorpho.mainnet;
      sourceNetworkName = "mainnet";
      if (!process.env.PROVIDER_URL) {
        throw new Error("PROVIDER_URL env var required");
      }
      sourceChainProvider = new ethers.providers.JsonRpcProvider(
        process.env.PROVIDER_URL
      );
    } else {
      throw new Error(`Unsupported destination chainId: ${chainId}`);
    }

    const storeFilePath = path.join(
      __dirname,
      "..",
      `.localKeyValueStorage.${sourceNetworkName}`
    );
    const store = keyValueStoreLocalClient({ _storePath: storeFilePath });

    await processCctpBridgeTransactions({
      ...args,
      destinationChainSigner: signer,
      sourceChainProvider,
      store,
      networkName: sourceNetworkName,
      blockLookback: config.blockLookback,
      cctpDestinationDomainId: config.cctpDestinationDomainId,
      cctpSourceDomainId: config.cctpSourceDomainId,
      cctpIntegrationContractAddress: config.cctpIntegrationContractAddress,
      cctpIntegrationContractAddressDestination:
        config.cctpIntegrationContractAddressDestination,
    });
  },
});
