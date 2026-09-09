const { expect } = require("chai");

const { processCctpBridgeTransactions } = require("../../../tasks/crossChain");
const {
  encodeBalanceCheckMessageBody,
  encodeBurnMessageBody,
  encodeDepositMessageBody,
} = require("./_crosschain-helpers");
const {
  DESTINATION_DOMAIN,
  DESTINATION_STRATEGY,
  FakeDestinationSigner,
  PEER_STRATEGY,
  cctpMessageFixture,
  fakeSourceProvider,
  memoryStore,
  relayArgs,
  stubCircleApi,
} = require("./_relay-fakes");

// Drives the relay loop itself, not just the pure helpers it calls.
//
// The July stall (#2938) lived in an inline conjunct of this function, not in a
// function a pure test could reach: the on-chain `isNonceProcessed` guard was
// applied to every message, and periodic balance updates reuse the settled
// `lastTransferNonce`, so each one was dropped *and* written to the local store
// as "processed" — permanently, since nothing clears that store. #2986 fixed it
// with `nonceIsReplayKey`. The first test below is that regression.
describe("Unit: processCctpBridgeTransactions (CCTP relay)", () => {
  const TX_HASH = `0x${"11".repeat(32)}`;
  const EVENT_NONCE = "0xevent1";
  const USDC = "0x0000000000000000000000000000000000000505";
  const AMOUNT = "1000000"; // 1 USDC
  const BALANCE = "5000000000"; // 5,000 USDC
  const TIMESTAMP = 1700000000;

  // The nonce a transfer settled on, which every later periodic balance update
  // carries again.
  const SETTLED_NONCE = 123;

  const txStoreKey = `cctp_message_${TX_HASH}_${DESTINATION_DOMAIN}`;
  const messageStoreKey = (eventNonce = EVENT_NONCE) =>
    `cctp_message_${eventNonce}`;

  const balanceCheckBody = (nonce, transferConfirmation) =>
    encodeBalanceCheckMessageBody(
      nonce,
      BALANCE,
      transferConfirmation,
      TIMESTAMP
    );

  const depositBody = (nonce) =>
    encodeBurnMessageBody(
      PEER_STRATEGY,
      DESTINATION_STRATEGY,
      USDC,
      AMOUNT,
      encodeDepositMessageBody(nonce, AMOUNT)
    );

  let circleApi;

  afterEach(() => {
    if (circleApi) {
      circleApi.restore();
      circleApi = undefined;
    }
  });

  // Wires the fakes together and runs one relay pass over a single source tx.
  const relay = async ({
    messages,
    processedNonces = [],
    storedValues = {},
    receiptStatus = 1,
    ...overrides
  }) => {
    circleApi = stubCircleApi({ [TX_HASH]: messages });
    const signer = new FakeDestinationSigner({
      processedNonces,
      receiptStatus,
    });
    const sourceChainProvider = fakeSourceProvider({ txHashes: [TX_HASH] });
    const store = memoryStore(storedValues);

    await processCctpBridgeTransactions(
      relayArgs({ signer, sourceChainProvider, store, ...overrides })
    );

    return { signer, store, sourceChainProvider };
  };

  // ── The #2938 regression ────────────────────────────────────
  it("relays a periodic balance check whose nonce is already settled on-chain", async () => {
    const message = cctpMessageFixture({
      body: balanceCheckBody(SETTLED_NONCE, false),
      eventNonce: EVENT_NONCE,
    });

    const { signer, store } = await relay({
      messages: [message],
      processedNonces: [SETTLED_NONCE],
    });

    expect(signer.relayCalls).to.have.lengthOf(1);
    expect(signer.relayCalls[0].message).to.equal(message.message);
    expect(store.values.get(messageStoreKey())).to.equal("processed");
  });

  it("skips a transfer-confirmation balance check whose nonce is already processed", async () => {
    const { signer, store } = await relay({
      messages: [
        cctpMessageFixture({
          body: balanceCheckBody(SETTLED_NONCE, true),
          eventNonce: EVENT_NONCE,
        }),
      ],
      processedNonces: [SETTLED_NONCE],
    });

    expect(signer.relayCalls).to.have.lengthOf(0);
    expect(store.values.get(messageStoreKey())).to.equal("processed");
  });

  it("skips a deposit whose nonce is already processed", async () => {
    const { signer, store } = await relay({
      messages: [
        cctpMessageFixture({ body: depositBody(7), eventNonce: EVENT_NONCE }),
      ],
      processedNonces: [7],
    });

    expect(signer.nonceQueries).to.deep.equal(["7"]);
    expect(signer.relayCalls).to.have.lengthOf(0);
    expect(store.values.get(messageStoreKey())).to.equal("processed");
  });

  it("relays an unprocessed deposit and marks it only after a successful receipt", async () => {
    const message = cctpMessageFixture({
      body: depositBody(7),
      eventNonce: EVENT_NONCE,
    });

    const { signer, store } = await relay({ messages: [message] });

    expect(signer.relayCalls).to.have.lengthOf(1);
    expect(signer.relayCalls[0].to).to.equal(DESTINATION_STRATEGY);
    expect(signer.relayCalls[0].message).to.equal(message.message);
    expect(signer.relayCalls[0].attestation).to.equal(message.attestation);
    // The message key is written after the relay, the tx key after the loop.
    expect(store.writes.map((w) => w.key)).to.deep.equal([
      messageStoreKey(),
      txStoreKey,
    ]);
  });

  it("short-circuits on the message-level store key without querying the chain", async () => {
    const { signer } = await relay({
      messages: [
        cctpMessageFixture({ body: depositBody(7), eventNonce: EVENT_NONCE }),
      ],
      storedValues: { [messageStoreKey()]: "processed" },
    });

    expect(signer.nonceQueries).to.have.lengthOf(0);
    expect(signer.relayCalls).to.have.lengthOf(0);
  });

  it("leaves the tx-level key unwritten while a message is not yet attested", async () => {
    const { signer, store } = await relay({
      messages: [
        cctpMessageFixture({
          body: depositBody(7),
          eventNonce: EVENT_NONCE,
          status: "pending_confirmations",
        }),
      ],
    });

    expect(signer.relayCalls).to.have.lengthOf(0);
    // Writing it would retire the transaction before it was ever relayed.
    expect(store.values.has(txStoreKey)).to.equal(false);
  });

  it("bypasses the store dedup on a manual run but still honours the on-chain guard", async () => {
    const { signer } = await relay({
      messages: [
        cctpMessageFixture({ body: depositBody(7), eventNonce: EVENT_NONCE }),
      ],
      storedValues: {
        [txStoreKey]: "processed",
        [messageStoreKey()]: "processed",
      },
      txHash: TX_HASH,
    });

    expect(signer.nonceQueries).to.deep.equal(["7"]);
    expect(signer.relayCalls).to.have.lengthOf(1);
  });

  it("rejects a malformed manual tx hash", async () => {
    let error;
    try {
      await relay({
        messages: [
          cctpMessageFixture({ body: depositBody(7), eventNonce: EVENT_NONCE }),
        ],
        txHash: "0xnothex",
      });
    } catch (err) {
      error = err;
    }

    expect(error).to.be.an("error");
    expect(error.message).to.equal("Invalid tx hash: 0xnothex");
  });

  it("skips a message addressed to another destination and retires the tx", async () => {
    const { signer, store } = await relay({
      messages: [
        cctpMessageFixture({
          body: depositBody(7),
          eventNonce: EVENT_NONCE,
          destinationCaller: "0x00000000000000000000000000000000000009f9",
        }),
      ],
    });

    expect(signer.nonceQueries).to.have.lengthOf(0);
    expect(signer.relayCalls).to.have.lengthOf(0);
    expect(store.values.get(txStoreKey)).to.equal("processed");
  });

  // The shape the stall actually took on chain: a settled transfer, then
  // periodic updates reusing its nonce, all arriving through the same relay.
  it("handles a settled transfer and a periodic update sharing one nonce", async () => {
    const settled = cctpMessageFixture({
      body: depositBody(SETTLED_NONCE),
      eventNonce: "0xevent1",
    });
    const periodic = cctpMessageFixture({
      body: balanceCheckBody(SETTLED_NONCE, false),
      eventNonce: "0xevent2",
    });

    const { signer, store } = await relay({
      messages: [settled, periodic],
      processedNonces: [SETTLED_NONCE],
    });

    expect(signer.relayCalls).to.have.lengthOf(1);
    expect(signer.relayCalls[0].message).to.equal(periodic.message);
    expect(store.values.get(messageStoreKey("0xevent1"))).to.equal("processed");
    expect(store.values.get(messageStoreKey("0xevent2"))).to.equal("processed");
  });
});
