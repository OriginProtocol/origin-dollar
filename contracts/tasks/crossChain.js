//const { KeyValueStoreClient } = require("@openzeppelin/defender-sdk");
const addresses = require("../utils/addresses");
const { getNetworkName } = require("../utils/hardhat-helpers");
const { logTxDetails } = require("../utils/txLogger");
const fs = require("fs");
const path = require("path");

const log = require("../utils/logger")("task:crossChain");

const keyValueStoreLocalClient = ({ _storePath }) => ({
  storePath: _storePath,

  async get(key) {
    return this.getStore()[key];
  },

  async put(key, value) {
    this.updateStore((store) => {
      store[key] = value;
    });
  },

  async del(key) {
    this.updateStore((store) => {
      delete store[key];
    });
  },

  getStore() {
    try {
      if (!fs.existsSync(this.storePath)) {
        return {};
      }
      const contents = fs.readFileSync(this.storePath, "utf8");
      return contents ? JSON.parse(contents) : {};
    } catch (error) {
      return {};
    }
  },

  updateStore(updater) {
    const store = this.getStore();
    updater(store);
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2));
  },
});

const cctpOperationsConfig = async (signer, provider) => {
  const networkName = await getNetworkName();
  const isMainnet = networkName === "mainnet";
  const isBase = networkName === "base";
  // CCTP TESTNET API: https://iris-api-sandbox.circle.com
  const cctpApi = "https://iris-api.circle.com";
  //const cctpApiKey = process.env.CIRCLE_API_KEY;

  let cctpDestinationDomainId,
    cctpSourceDomainId,
    cctpIntegrationContractAddress,
    cctpIntegrationContractAddressDestination;
  if (isMainnet) {
    cctpDestinationDomainId = 6;
    cctpSourceDomainId = 0;
    cctpIntegrationContractAddress = addresses.mainnet.CrossChainMasterStrategy;
    cctpIntegrationContractAddressDestination =
      addresses.base.CrossChainRemoteStrategy;
  } else if (isBase) {
    cctpDestinationDomainId = 0;
    cctpSourceDomainId = 6;
    cctpIntegrationContractAddress = addresses.base.CrossChainRemoteStrategy;
    cctpIntegrationContractAddressDestination =
      addresses.mainnet.CrossChainMasterStrategy;
  } else {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  const cctpIntegratorAbi = [
    "event TokensBridged(uint32 peerDomainID,address peerStrategy,address usdcToken,uint256 tokenAmount,uint256 maxFee,uint32 minFinalityThreshold,bytes hookData)",
    "event MessageTransmitted(uint32 peerDomainID,address peerStrategy,uint32 minFinalityThreshold,bytes message)",
    "function relay(bytes message, bytes attestation) external",
  ];

  const cctpIntegrationContractSource = new ethers.Contract(
    cctpIntegrationContractAddress,
    cctpIntegratorAbi,
    provider
  );
  const cctpIntegrationContractDestination = new ethers.Contract(
    cctpIntegrationContractAddressDestination,
    cctpIntegratorAbi,
    signer
  );

  return {
    networkName,
    cctpApi,
    provider,
    cctpIntegrationContractSource,
    cctpIntegrationContractDestination,
    cctpDestinationDomainId,
    cctpSourceDomainId,
  };
};

const fetchAttestation = async ({ transactionHash, cctpApi, cctpChainId }) => {
  log(
    `Fetching attestation for transaction hash: ${transactionHash} on cctp chain id: ${cctpChainId}`
  );
  const response = await fetch(
    `${cctpApi}/v2/messages/${cctpChainId}?transactionHash=${transactionHash}`
  );
  if (!response.ok) {
    throw new Error(
      `Error fetching attestation code: ${
        response.status
      } error: ${await response.text()}`
    );
  }
  const resultJson = await response.json();

  if (resultJson.messages.length !== 1) {
    throw new Error(
      `Expected 1 attestation, got ${resultJson.messages.length}`
    );
  }

  const message = resultJson.messages[0];
  const status = message.status;
  if (status !== "complete") {
    throw new Error(`Attestation is not complete, status: ${status}`);
  }

  const decodedMessage = message.decodedMessage;
  const minFinalityThreshold = decodedMessage.minFinalityThreshold;
  const finalityThresholdExecuted =
    message.decodedMessage.finalityThresholdExecuted;

  if (minFinalityThreshold !== finalityThresholdExecuted) {
    return {
      status: "not-finalized",
    };
  }

  return {
    attestation: message.attestation,
    message: message.message,
    status: "ok",
  };
};

// TokensBridged & MessageTransmitted are the 2 events that are emitted when a transaction is published to the CCTP contract
// One transaction containing such message can at most only contain one of these events
const fetchTxHashesFromCctpTransactions = async ({
  config,
  overrideBlock,
} = {}) => {
  const provider = hre.ethers.provider;

  let resolvedFromBlock, resolvedToBlock;
  if (overrideBlock) {
    resolvedFromBlock = overrideBlock;
    resolvedToBlock = overrideBlock;
  } else {
    const latestBlock = await provider.getBlockNumber();
    resolvedFromBlock = Math.max(latestBlock - 10000, 0);
    resolvedToBlock = latestBlock;
  }

  const cctpIntegrationContractSource = config.cctpIntegrationContractSource;

  const tokensBridgedTopic =
    cctpIntegrationContractSource.interface.getEventTopic("TokensBridged");
  const messageTransmittedTopic =
    cctpIntegrationContractSource.interface.getEventTopic("MessageTransmitted");

  log(
    `Fetching event logs from block ${resolvedFromBlock} to block ${resolvedToBlock}`
  );
  const [eventLogsTokenBridged, eventLogsMessageTransmitted] =
    await Promise.all([
      provider.getLogs({
        address: cctpIntegrationContractSource.address,
        fromBlock: resolvedFromBlock,
        toBlock: resolvedToBlock,
        topics: [tokensBridgedTopic],
      }),
      provider.getLogs({
        address: cctpIntegrationContractSource.address,
        fromBlock: resolvedFromBlock,
        toBlock: resolvedToBlock,
        topics: [messageTransmittedTopic],
      }),
    ]);

  // There should be no duplicates in the event logs, but still deduplicate to be safe
  const possiblyDuplicatedTxHashes = [
    ...eventLogsTokenBridged,
    ...eventLogsMessageTransmitted,
  ].map((log) => log.transactionHash);
  const allTxHashes = Array.from(new Set([...possiblyDuplicatedTxHashes]));

  log(`Found ${allTxHashes.length} transactions that emitted messages`);
  return { allTxHashes };
};

const processCctpBridgeTransactions = async ({
  block = undefined,
  signer,
  provider,
  store,
}) => {
  const config = await cctpOperationsConfig(signer, provider);
  log(
    `Fetching cctp messages posted on ${config.networkName} network.${
      block ? ` Only for block: ${block}` : " Looking at most recent blocks"
    }`
  );

  const { allTxHashes } = await fetchTxHashesFromCctpTransactions({
    config,
    overrideBlock: block,
  });
  for (const txHash of allTxHashes) {
    const storeKey = `cctp_message_${txHash}`;
    const storedValue = await store.get(storeKey);

    if (storedValue === "processed") {
      log(
        `Transaction with hash: ${txHash} has already been processed. Skipping...`
      );
      continue;
    }

    const { attestation, message, status } = await fetchAttestation({
      transactionHash: txHash,
      cctpApi: config.cctpApi,
      cctpChainId: config.cctpSourceDomainId,
    });
    if (status !== "ok") {
      log(
        `Attestation from tx hash: ${txHash} on cctp chain id: ${config.cctpSourceDomainId} is not attested yet, status: ${status}. Skipping...`
      );
    }

    log(
      `Attempting to relay attestation with tx hash: ${txHash} to cctp chain id: ${config.cctpDestinationDomainId}`
    );
    const relayTx = await config.cctpIntegrationContractDestination.relay(
      message,
      attestation
    );
    log(
      `Relay transaction with hash ${relayTx.hash} sent to cctp chain id: ${config.cctpDestinationDomainId}`
    );
    const receipt = await logTxDetails(relayTx, "CCTP relay");

    // Final verification
    if (receipt.status === 1) {
      log("SUCCESS: Transaction executed successfully!");
      await store.put(storeKey, "processed");
    } else {
      log("FAILURE: Transaction reverted!");
      throw new Error(`Transaction reverted - status: ${receipt.status}`);
    }
  }
};

module.exports = {
  keyValueStoreLocalClient,
  processCctpBridgeTransactions,
};
