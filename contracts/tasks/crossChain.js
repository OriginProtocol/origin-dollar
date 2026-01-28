//const { KeyValueStoreClient } = require("@openzeppelin/defender-sdk");
const ethers = require("ethers");
const { logTxDetails } = require("../utils/txLogger");
const { api: cctpApi } = require("../utils/cctp");

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

const fetchAttestation = async ({ transactionHash, cctpChainId }) => {
  console.log(
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

  console.log(
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

  console.log(`Found ${allTxHashes.length} transactions that emitted messages`);
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
  console.log(
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
    const storeKey = `cctp_message_${txHash}`;
    const storedValue = await store.get(storeKey);

    if (storedValue === "processed") {
      console.log(
        `Transaction with hash: ${txHash} has already been processed. Skipping...`
      );
      continue;
    }

    const { attestation, message, status } = await fetchAttestation({
      transactionHash: txHash,
      cctpChainId: cctpSourceDomainId,
    });
    if (status !== "ok") {
      console.log(
        `Attestation from tx hash: ${txHash} on cctp chain id: ${config.cctpSourceDomainId} is not attested yet, status: ${status}. Skipping...`
      );
    }

    console.log(
      `Attempting to relay attestation with tx hash: ${txHash} and message: ${message} to cctp chain id: ${cctpDestinationDomainId}`
    );

    if (dryrun) {
      console.log(
        `Dryrun: Would have relayed attestation with tx hash: ${txHash} to cctp chain id: ${cctpDestinationDomainId}`
      );
      continue;
    }

    const relayTx = await config.cctpIntegrationContractDestination.relay(
      message,
      attestation
    );
    console.log(
      `Relay transaction with hash ${relayTx.hash} sent to cctp chain id: ${cctpDestinationDomainId}`
    );
    const receipt = await logTxDetails(relayTx, "CCTP relay");

    // Final verification
    if (receipt.status === 1) {
      console.log("SUCCESS: Transaction executed successfully!");
      await store.put(storeKey, "processed");
    } else {
      console.log("FAILURE: Transaction reverted!");
      throw new Error(`Transaction reverted - status: ${receipt.status}`);
    }
  }
};

module.exports = {
  processCctpBridgeTransactions,
};
