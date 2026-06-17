//const { KeyValueStoreClient } = require("@openzeppelin/defender-sdk");
const ethers = require("ethers");
const { logTxDetails } = require("../utils/txLogger");
const { api: cctpApi } = require("../utils/cctp");
const log = require("../utils/logger")("task:crossChain");

const cctpOperationsConfig = async ({
  destinationChainSigner,
  sourceChainProvider,
  networkName,
  cctpIntegrationContractAddress,
  cctpIntegrationContractAddressDestination,
}) => {
  const cctpIntegratorAbi = [
    "event TokensBridged(uint32 peerDomainID,address peerStrategy,address usdcToken,uint256 tokenAmount,uint256 maxFee,uint32 minFinalityThreshold,bytes hookData)",
    "event MessageTransmitted(uint32 peerDomainID,address peerStrategy,uint32 minFinalityThreshold,bytes message)",
    "function relay(bytes message, bytes attestation) external",
  ];

  const cctpIntegrationContractSource = new ethers.Contract(
    cctpIntegrationContractAddress,
    cctpIntegratorAbi,
    sourceChainProvider
  );
  const cctpIntegrationContractDestination = new ethers.Contract(
    cctpIntegrationContractAddressDestination,
    cctpIntegratorAbi,
    destinationChainSigner
  );

  return {
    networkName,
    cctpIntegrationContractSource,
    cctpIntegrationContractDestination,
  };
};

const fetchAttestations = async ({ transactionHash, cctpChainId }) => {
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
  const fetchedMessages = resultJson.messages;
  if (!Array.isArray(fetchedMessages)) {
    throw new Error(
      `Invalid attestation payload for tx ${transactionHash}: messages is not an array`
    );
  }

  return fetchedMessages.map((message, index) => ({
    attestation: message.attestation,
    message: message.message,
    status: message.status,
    eventNonce: message.eventNonce,
    decodedMessage: message.decodedMessage,
    index,
  }));
};

const normalizeAddress = (address) => {
  try {
    return ethers.utils.getAddress(address);
  } catch (error) {
    return null;
  }
};

const isMessageForDestination = ({
  decodedMessage,
  destinationCaller,
  destinationDomainId,
}) => {
  if (!decodedMessage) {
    return false;
  }

  const decodedDestinationCaller = normalizeAddress(
    decodedMessage.destinationCaller
  );
  const normalizedDestinationCaller = normalizeAddress(destinationCaller);
  const decodedDestinationDomain = String(decodedMessage.destinationDomain);

  if (!decodedDestinationCaller || !normalizedDestinationCaller) {
    return false;
  }

  return (
    decodedDestinationCaller === normalizedDestinationCaller &&
    decodedDestinationDomain === String(destinationDomainId)
  );
};

// TokensBridged & MessageTransmitted are emitted when a CCTP message is posted.
// A single source transaction can emit multiple CCTP messages.
const fetchTxHashesFromCctpTransactions = async ({
  config,
  blockLookback,
  overrideBlock,
  sourceChainProvider,
} = {}) => {
  let resolvedFromBlock, resolvedToBlock;
  if (overrideBlock) {
    resolvedFromBlock = overrideBlock;
    resolvedToBlock = overrideBlock;
  } else {
    const latestBlock = await sourceChainProvider.getBlockNumber();
    resolvedFromBlock = Math.max(latestBlock - blockLookback, 0);
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
      sourceChainProvider.getLogs({
        address: cctpIntegrationContractSource.address,
        fromBlock: resolvedFromBlock,
        toBlock: resolvedToBlock,
        topics: [tokensBridgedTopic],
      }),
      sourceChainProvider.getLogs({
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
  dryrun = false,
  destinationChainSigner,
  sourceChainProvider,
  store,
  networkName,
  blockLookback,
  cctpDestinationDomainId,
  cctpSourceDomainId,
  cctpIntegrationContractAddress,
  cctpIntegrationContractAddressDestination,
}) => {
  const config = await cctpOperationsConfig({
    destinationChainSigner,
    sourceChainProvider,
    networkName,
    cctpIntegrationContractAddress,
    cctpIntegrationContractAddressDestination,
  });
  log(
    `Fetching cctp messages posted on ${config.networkName} network.${
      block ? ` Only for block: ${block}` : " Looking at most recent blocks"
    }`
  );

  const { allTxHashes } = await fetchTxHashesFromCctpTransactions({
    config,
    overrideBlock: block,
    sourceChainProvider,
    blockLookback,
  });
  for (const txHash of allTxHashes) {
    const txStoreKey = `cctp_message_${txHash}_${cctpDestinationDomainId}`;
    // TODO: Legacy key can be removed after a few days of code deployment
    const txStoreKey_Legacy = `cctp_message_${txHash}`;
    const txStoredValue = await store.get(txStoreKey);
    const txStoredValue_Legacy = await store.get(txStoreKey_Legacy);
    if (txStoredValue === "processed" || txStoredValue_Legacy === "processed") {
      log(
        `Transaction with hash ${txHash} has already been processed via tx-level key ${txStoreKey}. Skipping...`
      );
      continue;
    }

    const cctpMessages = await fetchAttestations({
      transactionHash: txHash,
      cctpChainId: cctpSourceDomainId,
    });

    log(
      `Found ${cctpMessages.length} CCTP messages for transaction hash: ${txHash}`
    );

    const destinationAddress =
      config.cctpIntegrationContractDestination.address || "";
    let hasEligibleMessage = false;
    let hasUnprocessedEligibleMessages = false;

    for (const cctpMessage of cctpMessages) {
      const messageId =
        cctpMessage.eventNonce || `${txHash}_index_${cctpMessage.index}`;
      const storeKey = `cctp_message_${messageId}`;
      const storedValue = await store.get(storeKey);

      if (cctpMessage.status !== "complete") {
        log(
          `Message ${messageId} from tx ${txHash} is not attested yet (status: ${cctpMessage.status}). Skipping...`
        );
        hasEligibleMessage = true;
        hasUnprocessedEligibleMessages = true;
        continue;
      }

      const messageTargetsDestination = isMessageForDestination({
        decodedMessage: cctpMessage.decodedMessage,
        destinationCaller: destinationAddress,
        destinationDomainId: cctpDestinationDomainId,
      });
      if (!messageTargetsDestination) {
        log(
          `Skipping message ${messageId} from tx ${txHash} because it does not target destination caller ${destinationAddress} on domain ${cctpDestinationDomainId}`
        );
        continue;
      }
      hasEligibleMessage = true;

      if (storedValue === "processed") {
        log(
          `Message with key ${storeKey} has already been processed. Skipping...`
        );
        continue;
      }

      if (!cctpMessage.message || !cctpMessage.attestation) {
        log(
          `Message ${messageId} from tx ${txHash} is missing message payload or attestation. Skipping...`
        );
        hasUnprocessedEligibleMessages = true;
        continue;
      }

      log(
        `Attempting to relay message ${messageId} from tx hash: ${txHash} to cctp chain id: ${cctpDestinationDomainId}`
      );

      if (dryrun) {
        log(
          `Dryrun: Would have relayed message ${messageId} from tx hash: ${txHash} to cctp chain id: ${cctpDestinationDomainId}`
        );
        continue;
      }

      const relayTx = await config.cctpIntegrationContractDestination.relay(
        cctpMessage.message,
        cctpMessage.attestation,
        { gasLimit: 2000000 }
      );
      log(
        `Relay transaction with hash ${relayTx.hash} sent to cctp chain id: ${cctpDestinationDomainId}`
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

    const shouldMarkTxProcessed =
      !hasEligibleMessage || !hasUnprocessedEligibleMessages;
    if (shouldMarkTxProcessed) {
      await store.put(txStoreKey, "processed");
      log(`Marked tx ${txHash} as processed using tx-level key ${txStoreKey}`);
    } else {
      log(
        `Did not mark tx-level key ${txStoreKey} because eligible messages exist but none were fully processed for tx ${txHash}`
      );
    }
  }
};

module.exports = {
  processCctpBridgeTransactions,
};
