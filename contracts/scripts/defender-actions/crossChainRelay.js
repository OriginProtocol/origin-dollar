const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const { processCctpBridgeTransactions } = require("../../tasks/crossChain");
const { getNetworkName } = require("../../utils/hardhat-helpers");
const { configuration } = require("../../utils/cctp");

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  // Initialize defender relayer provider and signer
  const client = new Defender(event);
  // Chain ID of the target contract relayer signer
  const provider = client.relaySigner.getProvider({ ethersVersion: "v5" });
  const { chainId } = await provider.getNetwork();
  let sourceProvider;
  const signer = await client.relaySigner.getSigner(provider, {
    speed: "fastest",
    ethersVersion: "v5",
  });

  // destinatino chain is mainnet, source chain is base
  if (chainId === 1) {
    if (!event.secrets.BASE_PROVIDER_URL) {
      throw new Error("BASE_PROVIDER_URL env var required");
    }
    sourceProvider = new ethers.providers.JsonRpcProvider(
      event.secrets.BASE_PROVIDER_URL
    );
  }
  // destination chain is base, source chain is mainnet
  else if (chainId === 8453) {
    if (!event.secrets.PROVIDER_URL) {
      throw new Error("PROVIDER_URL env var required");
    }
    sourceProvider = new ethers.providers.JsonRpcProvider(
      event.secrets.PROVIDER_URL
    );
  } else {
    throw new Error(`Unsupported chain id: ${chainId}`);
  }

  const networkName = await getNetworkName(sourceProvider);
  const isMainnet = networkName === "mainnet";
  const isBase = networkName === "base";

  let config;
  if (isMainnet) {
    config = configuration.mainnetBaseMorpho.mainnet;
  } else if (isBase) {
    config = configuration.mainnetBaseMorpho.base;
  } else {
    throw new Error(`Unsupported network name: ${networkName}`);
  }

  await processCctpBridgeTransactions({
    destinationChainSigner: signer,
    sourceChainProvider: sourceProvider,
    store: client.keyValueStore,
    networkName,
    blockLookback: config.blockLookback,
    cctpDestinationDomainId: config.cctpDestinationDomainId,
    cctpSourceDomainId: config.cctpSourceDomainId,
    cctpIntegrationContractAddress: config.cctpIntegrationContractAddress,
    cctpIntegrationContractAddressDestination:
      config.cctpIntegrationContractAddressDestination,
  });
};

module.exports = { handler };
