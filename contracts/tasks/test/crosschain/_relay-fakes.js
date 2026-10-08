const ethers = require("ethers");

const { encodeCCTPMessage } = require("./_crosschain-helpers");

// Mirrors the two callable fragments `tasks/crossChain.js` builds its
// destination contract with. Declared separately on purpose: the code under
// test encodes calldata with its own copy of the ABI and these fakes decode it
// with this one, so a drift in either surfaces as an unrecognised selector
// rather than as a test that keeps passing against a call that no longer exists.
const DESTINATION_ABI = [
  "function relay(bytes message, bytes attestation) external",
  "function isNonceProcessed(uint64 nonce) view returns (bool)",
];
const destinationInterface = new ethers.utils.Interface(DESTINATION_ABI);

const SOURCE_STRATEGY = "0x0000000000000000000000000000000000000501";
const DESTINATION_STRATEGY = "0x0000000000000000000000000000000000000502";
const RELAYER_ADDRESS = "0x0000000000000000000000000000000000000503";
const PEER_STRATEGY = "0x0000000000000000000000000000000000000504";

// Circle domain ids, matching `cctpDomainIds` in utils/cctp.js.
const SOURCE_DOMAIN = 6; // Base
const DESTINATION_DOMAIN = 0; // Ethereum

/**
 * Destination-chain signer backed by an in-memory `isNonceProcessed` map and a
 * recorded `relay` outbox, driving a real `ethers.Contract`.
 *
 * ethers resolves a view call through `(contract.signer || contract.provider).call()`
 * and a state-changing call through `contract.signer.sendTransaction()`, so those
 * two overrides are the whole seam. `call` is overridden rather than inherited
 * because the base `Signer.call` populates gas fields first, which would need a
 * far larger provider fake for no added coverage.
 */
class FakeDestinationSigner extends ethers.Signer {
  constructor({ processedNonces = [], receiptStatus = 1 } = {}) {
    super();
    this.processedNonces = new Set(processedNonces.map(String));
    this.receiptStatus = receiptStatus;
    // Assertion surfaces.
    this.nonceQueries = [];
    this.relayCalls = [];
    ethers.utils.defineReadOnly(this, "provider", {
      _isProvider: true,
      call: async (tx) => this.call(tx),
    });
  }

  async getAddress() {
    return RELAYER_ADDRESS;
  }

  connect() {
    return this;
  }

  async signMessage() {
    throw new Error("FakeDestinationSigner cannot sign messages");
  }

  async signTransaction() {
    throw new Error("FakeDestinationSigner cannot sign transactions");
  }

  async call(tx) {
    const { name, args } = destinationInterface.parseTransaction({
      data: tx.data,
    });
    if (name !== "isNonceProcessed") {
      throw new Error(`Unexpected view call to the destination: ${name}`);
    }
    const nonce = args.nonce.toString();
    this.nonceQueries.push(nonce);
    return destinationInterface.encodeFunctionResult("isNonceProcessed", [
      this.processedNonces.has(nonce),
    ]);
  }

  async sendTransaction(tx) {
    const { name, args } = destinationInterface.parseTransaction({
      data: tx.data,
    });
    if (name !== "relay") {
      throw new Error(`Unexpected transaction to the destination: ${name}`);
    }
    this.relayCalls.push({
      to: tx.to,
      message: args.message,
      attestation: args.attestation,
    });

    const gasPrice = ethers.BigNumber.from(1e9);
    const status = this.receiptStatus;
    return {
      hash: `0x${this.relayCalls.length.toString(16).padStart(64, "0")}`,
      from: RELAYER_ADDRESS,
      gasPrice,
      // Shaped for the two consumers of this receipt: ethers' own
      // `addContractWait`, which maps over `logs`, and
      // utils/txLogger.logTxDetails, which multiplies gasUsed by the effective
      // gas price and throws on a non-1 status.
      wait: async () => ({
        status,
        blockNumber: 1,
        gasUsed: ethers.BigNumber.from(21000),
        effectiveGasPrice: gasPrice,
        logs: [],
      }),
    };
  }
}

/**
 * Source-chain provider. Only ever asked for the head block and for the
 * TokensBridged / MessageTransmitted logs, both of which the relay dedupes by
 * transaction hash — so answering both scans with the same hashes models one
 * transaction that emitted both events.
 */
const fakeSourceProvider = ({ blockNumber = 1000000, txHashes = [] } = {}) => ({
  _isProvider: true,
  logFilters: [],
  async getBlockNumber() {
    return blockNumber;
  },
  async getLogs(filter) {
    this.logFilters.push(filter);
    return txHashes.map((transactionHash) => ({ transactionHash }));
  },
});

/** In-memory stand-in for utils/localKeyValueStore, recording every write. */
const memoryStore = (initial = {}) => ({
  values: new Map(Object.entries(initial)),
  writes: [],
  async get(key) {
    return this.values.get(key);
  },
  async put(key, value) {
    this.values.set(key, value);
    this.writes.push({ key, value });
  },
  async del(key) {
    this.values.delete(key);
  },
});

/**
 * Swap global fetch for one answering Circle's
 * `/v2/messages/<domain>?transactionHash=<hash>` with a canned payload, so
 * `fetchAttestations` and its own response mapping stay inside the code path.
 */
const stubCircleApi = (messagesByTxHash) => {
  const originalFetch = globalThis.fetch;
  const requestedTxHashes = [];

  globalThis.fetch = async (url) => {
    const txHash = new URL(url).searchParams.get("transactionHash");
    requestedTxHashes.push(txHash);
    const messages = messagesByTxHash[txHash];
    if (!messages) {
      return {
        ok: false,
        status: 404,
        text: async () => `no attestation fixture for ${txHash}`,
      };
    }
    return { ok: true, json: async () => ({ messages }) };
  };

  return {
    requestedTxHashes,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
};

/**
 * One entry of Circle's `messages` array, wrapping an Origin message body in a
 * CCTP envelope. Defaults target the destination the relay is configured with,
 * so a test only overrides what it is actually about.
 */
const cctpMessageFixture = ({
  body,
  eventNonce,
  status = "complete",
  attestation = "0xa77e57a7",
  destinationCaller = DESTINATION_STRATEGY,
  destinationDomain = DESTINATION_DOMAIN,
}) => ({
  message: encodeCCTPMessage(
    SOURCE_DOMAIN,
    PEER_STRATEGY,
    DESTINATION_STRATEGY,
    body
  ),
  attestation,
  status,
  eventNonce,
  decodedMessage: { destinationCaller, destinationDomain },
});

/** The full argument object for processCctpBridgeTransactions. */
const relayArgs = ({ signer, sourceChainProvider, store, ...overrides }) => ({
  destinationChainSigner: signer,
  sourceChainProvider,
  store,
  networkName: "base",
  blockLookback: 100,
  cctpSourceDomainId: SOURCE_DOMAIN,
  cctpDestinationDomainId: DESTINATION_DOMAIN,
  cctpIntegrationContractAddress: SOURCE_STRATEGY,
  cctpIntegrationContractAddressDestination: DESTINATION_STRATEGY,
  ...overrides,
});

module.exports = {
  DESTINATION_DOMAIN,
  DESTINATION_STRATEGY,
  FakeDestinationSigner,
  PEER_STRATEGY,
  SOURCE_DOMAIN,
  SOURCE_STRATEGY,
  cctpMessageFixture,
  fakeSourceProvider,
  memoryStore,
  relayArgs,
  stubCircleApi,
};
