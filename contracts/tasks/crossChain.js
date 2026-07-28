const ethers = require("ethers");
const { logTxDetails } = require("../utils/txLogger");
const { api: cctpApi } = require("../utils/cctp");
const log = require("../utils/logger")("task:crossChain");

// 0x-prefixed 32-byte tx hash
const TX_HASH_REGEX = /^0x([A-Fa-f0-9]{64})$/;

// Layout constants mirror the on-chain decoders so the script extracts the
// same Origin nonce the contract would.
// Ref: contracts/strategies/crosschain/CrossChainStrategyHelper.sol
//      and AbstractCCTPIntegrator.sol
const ORIGIN_MESSAGE_VERSION = 1010; // CrossChainStrategyHelper.ORIGIN_MESSAGE_VERSION
const CCTP_MESSAGE_BODY_INDEX = 148; // CrossChainStrategyHelper.MESSAGE_BODY_INDEX
const BURN_MESSAGE_V2_HOOK_DATA_INDEX = 228; // AbstractCCTPIntegrator.BURN_MESSAGE_V2_HOOK_DATA_INDEX
// Origin message: 4 bytes version + 4 bytes type, then the abi-encoded payload
const ORIGIN_PAYLOAD_INDEX = 8;

// Read a big-endian uint32 from a Uint8Array at the given byte offset.
const readUint32 = (bytes, start) =>
  (bytes[start] << 24) |
  (bytes[start + 1] << 16) |
  (bytes[start + 2] << 8) |
  bytes[start + 3];

/**
 * Decode the Origin transfer nonce from a raw CCTP message, mirroring the
 * on-chain relay decoding. Returns the nonce as an ethers BigNumber, or null
 * if the message is not one of our Origin messages (deposit / withdraw /
 * balance check).
 *
 * The Origin message is either:
 *  - the CCTP message body directly (plain message: withdraw / balance check), or
 *  - the burn message hook data (deposit), located at byte 228 of the body.
 * The nonce is the first abi-encoded word of the Origin payload.
 */
const decodeOriginNonce = (messageHex) => {
  if (!messageHex) {
    return null;
  }
  const bytes = ethers.utils.arrayify(messageHex);
  if (bytes.length < CCTP_MESSAGE_BODY_INDEX + 4) {
    return null;
  }
  const body = bytes.slice(CCTP_MESSAGE_BODY_INDEX);

  let originMessage;
  if (readUint32(body, 0) === ORIGIN_MESSAGE_VERSION) {
    // Plain message (withdraw / balance check): body is the Origin message
    originMessage = body;
  } else if (
    body.length >= BURN_MESSAGE_V2_HOOK_DATA_INDEX + 4 &&
    readUint32(body, BURN_MESSAGE_V2_HOOK_DATA_INDEX) === ORIGIN_MESSAGE_VERSION
  ) {
    // Burn message (deposit): Origin message is the hook data
    originMessage = body.slice(BURN_MESSAGE_V2_HOOK_DATA_INDEX);
  } else {
    return null;
  }

  if (originMessage.length < ORIGIN_PAYLOAD_INDEX + 32) {
    return null;
  }

  // Nonce is the first 32-byte abi word of the payload (a left-padded uint64)
  const nonceWord = originMessage.slice(
    ORIGIN_PAYLOAD_INDEX,
    ORIGIN_PAYLOAD_INDEX + 32
  );
  return ethers.BigNumber.from(nonceWord);
};

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
    "function isNonceProcessed(uint64 nonce) view returns (bool)",
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
  txHash = undefined,
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
  // When a tx hash is passed we relay only that transaction (skipping the
  // recent-events scan) and bypass the local store dedup, since the operator
  // explicitly asked for it. On-chain isNonceProcessed is the real safety net.
  const manualRun = Boolean(txHash);
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

  let allTxHashes;
  if (manualRun) {
    if (!TX_HASH_REGEX.test(txHash)) {
      throw new Error(`Invalid tx hash: ${txHash}`);
    }
    allTxHashes = [txHash.toLowerCase()];
    log(
      `Relaying only tx ${allTxHashes[0]} (manual). Skipping recent-events scan.`
    );
  } else {
    ({ allTxHashes } = await fetchTxHashesFromCctpTransactions({
      config,
      overrideBlock: block,
      sourceChainProvider,
      blockLookback,
    }));
  }
  for (const txHash of allTxHashes) {
    const txStoreKey = `cctp_message_${txHash}_${cctpDestinationDomainId}`;
    // TODO: Legacy key can be removed after a few days of code deployment
    const txStoreKey_Legacy = `cctp_message_${txHash}`;
    const txStoredValue = await store.get(txStoreKey);
    const txStoredValue_Legacy = await store.get(txStoreKey_Legacy);
    if (
      !manualRun &&
      (txStoredValue === "processed" || txStoredValue_Legacy === "processed")
    ) {
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

      if (!manualRun && storedValue === "processed") {
        log(
          `Message with key ${storeKey} has already been processed. Skipping...`
        );
        continue;
      }

      // Check on-chain whether this transfer nonce was already processed on the
      // destination strategy. If so, relaying would revert, so skip it and
      // reconcile the local store.
      const originNonce = decodeOriginNonce(cctpMessage.message);
      if (
        originNonce !== null &&
        (await config.cctpIntegrationContractDestination.isNonceProcessed(
          originNonce
        ))
      ) {
        log(
          `Nonce ${originNonce.toString()} for message ${messageId} from tx ${txHash} is already processed on-chain. Skipping relay...`
        );
        if (storedValue !== "processed") {
          await store.put(storeKey, "processed");
          log(`Marked message with key ${storeKey} as processed in store`);
        }
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
  decodeOriginNonce,
  TX_HASH_REGEX,
};
