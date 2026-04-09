/// <reference types="hardhat/types/runtime" />

import path from "path";
import { types } from "hardhat/config";
import { configuration } from "../../utils/cctp";
import { keyValueStoreLocalClient } from "../../utils/defender";
import { processCctpBridgeTransactions } from "../crossChain";
import { action } from "../lib/action";

action({
  name: "relayCCTPMessage",
  description:
    "Fetches CCTP attested Messages via Circle Gateway API and relays it to the integrator contract",
  chains: [1, 8453],
  params: (t) => {
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
  run: async ({ signer, networkName, args }) => {
    const storeFilePath = path.join(
      __dirname,
      "..",
      `.localKeyValueStorage.${networkName}`
    );
    const store = keyValueStoreLocalClient({ _storePath: storeFilePath });

    let config;
    if (networkName === "mainnet") {
      config = configuration.mainnetBaseMorpho.mainnet;
    } else if (networkName === "base") {
      config = configuration.mainnetBaseMorpho.base;
    } else {
      throw new Error(`Unsupported network name: ${networkName}`);
    }

    await processCctpBridgeTransactions({
      ...args,
      destinationChainSigner: signer,
      sourceChainProvider: hre.ethers.provider,
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
