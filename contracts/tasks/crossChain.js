//const { KeyValueStoreClient } = require("@openzeppelin/defender-sdk");
const addresses = require("../utils/addresses");
const { getNetworkName } = require("../utils/hardhat-helpers");
const { getSigner } = require("../utils/signers");
const { getClient } = require("./defender");

const log = require("../utils/logger")("task:crossChain");

const cctpOperationsConfig = async () => {
  const networkName = await getNetworkName();

  const addressesSet = addresses[networkName];
  const isMainnet = networkName === "mainnet";
  const isBase = networkName === "base";
  // CCTP TESTNET API: https://iris-api-sandbox.circle.com
  const cctpApi = "https://iris-api.circle.com";
  //const cctpApiKey = process.env.CIRCLE_API_KEY;
 
  let cctpDestinationDomainId, cctpSourceDomainId, cctpIntegrationContractAddress, cctpIntegrationContractAddressDestination, destinationChainRpcUrl;
  if (isMainnet) {
    cctpDestinationDomainId = 6;
    cctpSourceDomainId = 0;
    cctpIntegrationContractAddress = addressesSet.CrossChainMasterStrategy;
    cctpIntegrationContractAddressDestination = addresses.base.CrossChainRemoteStrategy;
  } else if (isBase) {
    cctpDestinationDomainId = 0;
    cctpSourceDomainId = 6;
    cctpIntegrationContractAddress = addressesSet.CrossChainRemoteStrategy;
    cctpIntegrationContractAddressDestination = addresses.mainnet.CrossChainMasterStrategy;
  } else {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  const jsonRpcProvider = new ethers.providers.JsonRpcProvider(destinationChainRpcUrl);
  const signer = await getSigner();

  const defenderClient = getClient();

  const messageTransmitter = await ethers.getContractAt("ICCTPMessageTransmitter", addresses.CCTPMessageTransmitterV2);
  const tokenMessenger = await ethers.getContractAt("ICCTPTokenMessenger", addresses.CCTPTokenMessengerV2);
  const cctpIntegrationContractSource = await ethers.getContractAt("AbstractCCTPIntegrator", cctpIntegrationContractAddress);
  const cctpIntegrationContractDestination = await ethers.getContractAt("AbstractCCTPIntegrator", cctpIntegrationContractAddressDestination, signer);

  return {
    networkName,
    cctpApi,
    defenderClient,
    jsonRpcProvider,
    messageTransmitter,
    tokenMessenger,
    cctpIntegrationContractSource,
    cctpIntegrationContractDestination,
    cctpDestinationDomainId,
    cctpSourceDomainId
  };
};

const fetchAttestation = async ({ transactionHash, cctpApi, cctpChainId }) => {
  log(`Fetching attestation for transaction hash: ${transactionHash} on cctp chain id: ${cctpChainId}`);
  const response = await fetch(`${cctpApi}/v2/messages/${cctpChainId}?transactionHash=${transactionHash}`);
  if (!response.ok) {
    throw new Error(`Error fetching attestation code: ${response.status} error: ${await response.text()}`);
  }
  const resultJson = await response.json();

  if (resultJson.messages.length !== 1) {
    throw new Error(`Expected 1 attestation, got ${resultJson.messages.length}`);
  }
  
  const message = resultJson.messages[0]
  const status = message.status;
  if (status !== "complete") {
    throw new Error(`Attestation is not complete, status: ${status}`);
  }

  const decodedMessage = message.decodedMessage;
  const minFinalityThreshold = decodedMessage.minFinalityThreshold;
  const finalityThresholdExecuted = message.decodedMessage.finalityThresholdExecuted;

  if (minFinalityThreshold !== finalityThresholdExecuted) {
    return {
      status: "not-finalized"
    }
  }

  return {
    attestation: message.attestation,
    message: message.message,
    status: "ok"
  }
};

// TokensBridged & MessageTransmitted are the 2 events that are emitted when a transaction is published to the CCTP contract
// One transaction containing such message can at most only contain one of these events
const fetchTxHashesFromCctpTransactions = async ({ config, overrideBlock } = {}) => {
  const provider = hre.ethers.provider;
  const latestBlock = await provider.getBlockNumber();
  let resolvedFromBlock, resolvedToBlock;
  if (overrideBlock) {
    resolvedFromBlock = overrideBlock;
    resolvedToBlock = overrideBlock;
  } else {
    resolvedFromBlock = Math.max(latestBlock - 10000, 0);
    resolvedToBlock = latestBlock;
  }

  const cctpIntegrationContractSource = config.cctpIntegrationContractSource;

  const tokensBridgedTopic = cctpIntegrationContractSource.interface.getEventTopic("TokensBridged");
  const messageTransmittedTopic = cctpIntegrationContractSource.interface.getEventTopic("MessageTransmitted");

  const [eventLogsTokenBridged, eventLogsMessageTransmitted] = await Promise.all([
    provider.getLogs({
      address: cctpIntegrationContractSource.address,
      fromBlock: resolvedFromBlock,
      toBlock: resolvedToBlock,
      topics: [tokensBridgedTopic]
    }),
    provider.getLogs({
      address: cctpIntegrationContractSource.address,
      fromBlock: resolvedFromBlock,
      toBlock: resolvedToBlock,
      topics: [messageTransmittedTopic]
    })
  ]);

  // There should be no duplicates in the event logs, but still deduplicate to be safe
  const possiblyDuplicatedTxHashes = [...eventLogsTokenBridged, ...eventLogsMessageTransmitted].map((log) => log.transactionHash);
  const allTxHashes = Array.from(new Set([...possiblyDuplicatedTxHashes]));

  log(`Found ${allTxHashes.length} transactions that emitted messages`);
  return { allTxHashes };
};

const processCctpBridgeTransactions = async ({ block = undefined }) => {
  const config = await cctpOperationsConfig();
  log(`Fetching cctp messages posted on ${config.networkName} network.${block ? `Only for block: ${block}` : "Looking at most recent blocks"}`);

  const { allTxHashes } = await fetchTxHashesFromCctpTransactions({ config, overrideBlock:block });
  for (const txHash of allTxHashes) {
    const { attestation, message, status } = await fetchAttestation({ transactionHash: txHash, cctpApi: config.cctpApi, cctpChainId: config.cctpSourceDomainId });
    if (status !== "ok") {
      log(`Attestation from tx hash: ${txHash} on cctp chain id: ${config.cctpSourceDomainId} is not attested yet, status: ${status}. Skipping...`);
    }

    log(`Attempting to relay attestation with tx hash: ${txHash} to cctp chain id: ${config.cctpDestinationDomainId}`);
    const relayResult = await config.cctpIntegrationContractDestination.relay(message, attestation);
    log(`Relay result: ${relayResult}`);
  }
};


module.exports = {
  processCctpBridgeTransactions
}