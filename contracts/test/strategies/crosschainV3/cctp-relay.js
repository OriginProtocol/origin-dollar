const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Covers CCTPAdapter.relay — the operator-driven entry point that finalises an inbound
 * CCTP message by handing it (with attestation) to the local MessageTransmitter, which then
 * calls back into `handleReceiveFinalizedMessage`. Because we set
 * `destinationCaller = address(this)` on the source burn, only this adapter can drive the
 * finalisation.
 */
describe("Unit: CCTPAdapter relay", function () {
  let governor, operator, stranger;
  let usdc, tokenMessenger, messageTransmitter, adapter, strategy;

  // Source-chain CCTP V2 domain; arbitrary non-zero for tests (AbstractAdapter rejects
  // chainSelector=0 at authorise time).
  const SOURCE_DOMAIN = 6;
  const DEST_GAS_LIMIT = 500000;

  // CCTP V2 wire-format encoder. Field offsets per Circle's spec:
  //   [0..4)   version (uint32)
  //   [4..8)   sourceDomain (uint32)
  //   [8..12)  destinationDomain (uint32)
  //   [12..44) nonce (bytes32)
  //   [44..76) sender (bytes32, right-aligned address)
  //   [76..108) recipient (bytes32, right-aligned address)
  //   [108..140) destinationCaller (bytes32)
  //   [140..144) minFinalityThreshold (uint32)
  //   [144..148) finalityThresholdExecuted (uint32)
  //   [148..]  messageBody
  function buildCCTPMessage({
    version = 1,
    sourceDomain = SOURCE_DOMAIN,
    sender,
    recipient,
    body,
  }) {
    return ethers.utils.solidityPack(
      [
        "uint32",
        "uint32",
        "uint32",
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
        "uint32",
        "uint32",
        "bytes",
      ],
      [
        version,
        sourceDomain,
        0,
        ethers.constants.HashZero,
        ethers.utils.hexZeroPad(sender, 32),
        ethers.utils.hexZeroPad(recipient, 32),
        ethers.constants.HashZero,
        0,
        0,
        body,
      ]
    );
  }

  // V3 app envelope: 20-byte sender + 32-byte intendedAmount + payload.
  function wrapAppEnvelope(envelopeSender, intendedAmount, payload) {
    return ethers.utils.solidityPack(
      ["address", "uint256", "bytes"],
      [envelopeSender, intendedAmount, payload]
    );
  }

  beforeEach(async () => {
    [governor, operator, stranger] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();

    const TransmitterFactory = await ethers.getContractFactory(
      "MockCCTPRelayTransmitter"
    );
    messageTransmitter = await TransmitterFactory.deploy();

    // CCTP TokenMessenger mock; constructor takes (usdc, transmitter). Outbound burn
    // isn't exercised in these tests but the adapter constructor wants a non-zero address.
    const TokenMessengerFactory = await ethers.getContractFactory(
      "CCTPTokenMessengerMock"
    );
    tokenMessenger = await TokenMessengerFactory.deploy(
      usdc.address,
      messageTransmitter.address
    );

    const AdapterFactory = await ethers.getContractFactory("CCTPAdapter");
    adapter = await AdapterFactory.connect(governor).deploy(
      usdc.address,
      tokenMessenger.address,
      messageTransmitter.address
    );

    // Operator gets the relay role; strangers don't.
    await adapter.connect(governor).setOperator(operator.address);

    // Strategy is just a recorder — MockBridgeReceiver — authorised on the adapter as the
    // peer strategy. Under CREATE3 parity its address would equal the source strategy's
    // address; we use the same address for both sides in unit tests.
    const StrategyFactory = await ethers.getContractFactory(
      "MockBridgeReceiver"
    );
    strategy = await StrategyFactory.connect(governor).deploy();

    await adapter.connect(governor).authorise(strategy.address, {
      paused: false,
      chainSelector: SOURCE_DOMAIN,
      destGasLimit: DEST_GAS_LIMIT,
    });
  });

  describe("access control", () => {
    it("rejects non-operator callers", async () => {
      const message = buildCCTPMessage({
        sender: adapter.address,
        recipient: adapter.address,
        body: wrapAppEnvelope(strategy.address, 0, "0x"),
      });
      await expect(
        adapter.connect(stranger).relay(message, "0x")
      ).to.be.revertedWith("CCTP: not operator");
    });

    it("governor can rotate the operator", async () => {
      const newOperator = stranger;
      await expect(adapter.connect(governor).setOperator(newOperator.address))
        .to.emit(adapter, "OperatorUpdated")
        .withArgs(operator.address, newOperator.address);

      // Old operator no longer authorised.
      const message = buildCCTPMessage({
        sender: adapter.address,
        recipient: adapter.address,
        body: wrapAppEnvelope(strategy.address, 0, "0x"),
      });
      await expect(
        adapter.connect(operator).relay(message, "0x")
      ).to.be.revertedWith("CCTP: not operator");

      // New operator works.
      await expect(adapter.connect(newOperator).relay(message, "0x")).to.not.be
        .reverted;
    });

    it("non-governor cannot set the operator", async () => {
      await expect(
        adapter.connect(stranger).setOperator(stranger.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("pre-validation", () => {
    it("rejects a message with an unexpected CCTP version", async () => {
      const message = buildCCTPMessage({
        version: 2, // not CCTP V2
        sender: adapter.address,
        recipient: adapter.address,
        body: wrapAppEnvelope(strategy.address, 0, "0x"),
      });
      await expect(
        adapter.connect(operator).relay(message, "0x")
      ).to.be.revertedWith("CCTP: bad msg version");
    });

    it("rejects a message whose recipient field is a different address", async () => {
      const message = buildCCTPMessage({
        sender: adapter.address,
        recipient: stranger.address, // not us
        body: wrapAppEnvelope(strategy.address, 0, "0x"),
      });
      await expect(
        adapter.connect(operator).relay(message, "0x")
      ).to.be.revertedWith("CCTP: not for us");
    });
  });

  describe("MessageTransmitter integration", () => {
    it("propagates MessageTransmitter.receiveMessage failure", async () => {
      await messageTransmitter.setShouldSucceed(false);
      const message = buildCCTPMessage({
        sender: adapter.address,
        recipient: adapter.address,
        body: wrapAppEnvelope(strategy.address, 0, "0x"),
      });
      await expect(
        adapter.connect(operator).relay(message, "0x")
      ).to.be.revertedWith("CCTP: relay failed");
    });

    it("emits MessageRelayed and forwards via the transmitter on success", async () => {
      const message = buildCCTPMessage({
        sender: adapter.address,
        recipient: adapter.address,
        body: wrapAppEnvelope(strategy.address, 0, "0x"),
      });
      await expect(adapter.connect(operator).relay(message, "0x"))
        .to.emit(adapter, "MessageRelayed")
        .withArgs(operator.address, SOURCE_DOMAIN);
    });
  });

  describe("end-to-end through _validateInbound + _deliver", () => {
    it("message-only delivery reaches the destination strategy with no token leg", async () => {
      const payload = ethers.utils.defaultAbiCoder.encode(
        ["string"],
        ["hello"]
      );
      const body = wrapAppEnvelope(strategy.address, 0, payload);
      const message = buildCCTPMessage({
        sender: adapter.address, // CREATE3 parity: source adapter == this adapter
        recipient: adapter.address,
        body,
      });

      await adapter.connect(operator).relay(message, "0x");

      // The mock recorder captured the receiveMessage callback. Pure-message path
      // delivers with token = address(0) (no token leg), regardless of the configured
      // USDC.
      expect(await strategy.callCount()).to.equal(1);
      expect(await strategy.lastSender()).to.equal(strategy.address);
      expect(await strategy.lastToken()).to.equal(ethers.constants.AddressZero);
      expect(await strategy.lastAmount()).to.equal(0);
      expect(await strategy.lastFeePaid()).to.equal(0);
      expect(await strategy.lastPayload()).to.equal(payload);
    });

    it("rejects a pure-message envelope that smuggles a non-zero intendedAmount", async () => {
      // Token-bearing messages MUST go through `relay()`'s burn-message path (with a
      // real CCTP burn body). Forcing intendedAmount > 0 down the pure-message hook is
      // a design violation and must revert.
      const body = wrapAppEnvelope(
        strategy.address,
        ethers.utils.parseUnits("100", 6),
        "0x"
      );
      const message = buildCCTPMessage({
        sender: adapter.address,
        recipient: adapter.address,
        body,
      });
      await expect(
        adapter.connect(operator).relay(message, "0x")
      ).to.be.revertedWith("CCTP: token leg via pure-message path");
    });

    it("rejects when the envelope sender isn't authorised", async () => {
      const body = wrapAppEnvelope(stranger.address, 0, "0x");
      const message = buildCCTPMessage({
        sender: adapter.address,
        recipient: adapter.address,
        body,
      });
      await expect(
        adapter.connect(operator).relay(message, "0x")
      ).to.be.revertedWith("Adapter: not authorised");
    });

    it("rejects when the source chain doesn't match the lane config", async () => {
      const body = wrapAppEnvelope(strategy.address, 0, "0x");
      const message = buildCCTPMessage({
        sourceDomain: 99, // unrelated domain
        sender: adapter.address,
        recipient: adapter.address,
        body,
      });
      await expect(
        adapter.connect(operator).relay(message, "0x")
      ).to.be.revertedWith("Adapter: wrong source chain");
    });

    it("rejects when the peer adapter parity check fails", async () => {
      const body = wrapAppEnvelope(strategy.address, 0, "0x");
      const message = buildCCTPMessage({
        sender: stranger.address, // not the peer adapter address
        recipient: adapter.address,
        body,
      });
      await expect(
        adapter.connect(operator).relay(message, "0x")
      ).to.be.revertedWith("Adapter: not from peer adapter");
    });
  });
});
