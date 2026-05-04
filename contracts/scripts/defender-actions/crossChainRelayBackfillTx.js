const { Defender } = require("@openzeppelin/defender-sdk");

/**
 * =========================
 *      Config Settings
 * =========================
 */
const HARDCODED_TRANSACTION_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const HARDCODED_DESTINATION_CHAIN_ID = 1;
/**
 * =========================
 *      End of Settings
 * =========================
 */

const TX_HASH_REGEX = /^0x([A-Fa-f0-9]{64})$/;
// we are hardcoding the destination chain id so the rollup built file is clean
const CHAIN_ID_TO_CCTP_DESTINATION_DOMAIN_ID = {
  1: 0, // Ethereum
  8453: 6, // Base
  999: 19, // HyperEVM
};

const getTransactionId = () => {
  if (!TX_HASH_REGEX.test(HARDCODED_TRANSACTION_ID)) {
    throw new Error(
      "HARDCODED_TRANSACTION_ID must be a valid 0x-prefixed 32-byte tx hash"
    );
  }
  return HARDCODED_TRANSACTION_ID.toLowerCase();
};

const getDestinationChainId = () => {
  if (
    typeof HARDCODED_DESTINATION_CHAIN_ID !== "number" ||
    !Number.isInteger(HARDCODED_DESTINATION_CHAIN_ID)
  ) {
    throw new Error("HARDCODED_DESTINATION_CHAIN_ID must be an integer");
  }
  if (
    CHAIN_ID_TO_CCTP_DESTINATION_DOMAIN_ID[HARDCODED_DESTINATION_CHAIN_ID] ===
    undefined
  ) {
    throw new Error(
      `Unsupported HARDCODED_DESTINATION_CHAIN_ID: ${HARDCODED_DESTINATION_CHAIN_ID}`
    );
  }
  return HARDCODED_DESTINATION_CHAIN_ID;
};

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  const client = new Defender(event);
  const chainId = getDestinationChainId();
  const cctpDestinationDomainId =
    CHAIN_ID_TO_CCTP_DESTINATION_DOMAIN_ID[chainId];

  const transactionId = getTransactionId();
  const legacyKey = `cctp_message_${transactionId}`;
  const chainScopedKey = `cctp_message_${transactionId}_${cctpDestinationDomainId}`;

  const [legacyValue, chainScopedValue] = await Promise.all([
    client.keyValueStore.get(legacyKey),
    client.keyValueStore.get(chainScopedKey),
  ]);

  const updates = {
    legacy: false,
    chainScoped: false,
  };

  if (legacyValue !== "processed") {
    await client.keyValueStore.put(legacyKey, "processed");
    updates.legacy = true;
    console.log(`Stored key ${legacyKey} with value processed`);
  } else {
    console.log(`Key ${legacyKey} already marked as processed`);
  }

  if (chainScopedValue !== "processed") {
    await client.keyValueStore.put(chainScopedKey, "processed");
    updates.chainScoped = true;
    console.log(`Stored key ${chainScopedKey} with value processed`);
  } else {
    console.log(`Key ${chainScopedKey} already marked as processed`);
  }

  return {
    transactionId,
    chainId,
    cctpDestinationDomainId,
    legacyKey,
    chainScopedKey,
    value: "processed",
    updated: updates,
  };
};

module.exports = { handler };
