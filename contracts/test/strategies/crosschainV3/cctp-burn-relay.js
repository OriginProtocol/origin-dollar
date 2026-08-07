const { expect } = require("chai");
const { ethers } = require("hardhat");

const { wrapAppEnvelope } = require("./_helpers");

/**
 * Coverage for `CCTPAdapter.relay()`'s burn-message path: the operator passes a CCTP V2
 * wire message whose transport `sender` is the source-side `TokenMessenger`. The adapter
 * must:
 *   - parse the inner burn body for `burnToken / amount / msgSender / feeExecuted / hookData`
 *   - call `messageTransmitter.receiveMessage` (which credits USDC to the adapter)
 *   - validate the hook data envelope via `_validateInbound`
 *   - dispatch `_deliver` with `amount - feeExecuted` (authoritative; not balanceOf-derived)
 *   - leave pre-existing residue/donation on the adapter (isolation)
 *
 * This path replaces the older "rely on CCTP V2.1 auto-callback" assumption that was
 * untested and unsafe on V2.0 deployments.
 */
describe("Unit: CCTPAdapter burn relay", function () {
  let governor, operator;
  let usdc, tokenMessenger, transmitter, adapter, strategy;

  const SOURCE_DOMAIN = 6;
  const DEST_GAS_LIMIT = 500000;

  // Address acting as the source-side TokenMessenger. The mock transmitter routes burn
  // messages based on transport sender == this value. Doesn't have to be a real contract.
  const SRC_TOKEN_MESSENGER = "0x000000000000000000000000000000000000C0DE";

  // CCTP V2 transport message builder (mirrors CCTPMessageHelper layout).
  function buildTransportMessage({
    sourceDomain,
    sender,
    recipient,
    body,
    finalityThresholdExecuted = 2000,
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
        1, // version
        sourceDomain,
        0, // destDomain
        ethers.constants.HashZero, // nonce
        ethers.utils.hexZeroPad(sender, 32),
        ethers.utils.hexZeroPad(recipient, 32),
        ethers.constants.HashZero, // destinationCaller
        2000, // minFinalityThreshold
        finalityThresholdExecuted,
        body,
      ]
    );
  }

  // CCTP V2 burn body builder (mirrors CCTPMessageHelper burn-body offsets):
  //   [0..4)     uint32  version
  //   [4..36)    bytes32 burnToken (right-aligned address)
  //   [36..68)   bytes32 mintRecipient
  //   [68..100)  uint256 amount
  //   [100..132) bytes32 msgSender
  //   [132..164) uint256 maxFee
  //   [164..196) uint256 feeExecuted
  //   [196..228) uint256 expirationBlock
  //   [228..]    bytes   hookData
  function buildBurnBody({
    burnToken,
    mintRecipient,
    amount,
    msgSender,
    feeExecuted,
    hookData,
  }) {
    return ethers.utils.solidityPack(
      [
        "uint32",
        "bytes32",
        "bytes32",
        "uint256",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "bytes",
      ],
      [
        1,
        ethers.utils.hexZeroPad(burnToken, 32),
        ethers.utils.hexZeroPad(mintRecipient, 32),
        amount,
        ethers.utils.hexZeroPad(msgSender, 32),
        0, // maxFee — informational only
        feeExecuted,
        0, // expirationBlock
        hookData,
      ]
    );
  }

  beforeEach(async () => {
    [governor, operator] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();

    const TransmitterFactory = await ethers.getContractFactory(
      "MockCCTPRelayTransmitter"
    );
    transmitter = await TransmitterFactory.deploy();
    // Configure the mock to recognize burn messages from SRC_TOKEN_MESSENGER and mint
    // USDC accordingly.
    await transmitter.setBurnConfig(SRC_TOKEN_MESSENGER, usdc.address);

    const TokenMessengerFactory = await ethers.getContractFactory(
      "CCTPTokenMessengerMock"
    );
    tokenMessenger = await TokenMessengerFactory.deploy(
      usdc.address,
      transmitter.address
    );

    const AdapterFactory = await ethers.getContractFactory("CCTPAdapter");
    adapter = await AdapterFactory.connect(governor).deploy(
      usdc.address,
      tokenMessenger.address,
      transmitter.address
    );
    // tokenMessenger address used by the adapter as "is this a burn message" check on the
    // transport sender — but our mock transmitter routes by SRC_TOKEN_MESSENGER instead
    // (real CCTP V2 has the source-side and dest-side TokenMessengers at the same address
    // under CREATE3 parity; the mock just lets us pick).
    await transmitter.setBurnConfig(tokenMessenger.address, usdc.address);

    await adapter.connect(governor).setOperator(operator.address);
    await adapter.connect(governor).setMinFinalityThreshold(2000);

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

  it("dispatches authoritative amount - feeExecuted from the burn body", async () => {
    const amount = ethers.utils.parseUnits("100", 6);
    const feeExecuted = ethers.utils.parseUnits("0.5", 6); // 0.5 USDC fast-finality fee
    const payload = ethers.utils.defaultAbiCoder.encode(["string"], ["claim"]);
    const hookData = wrapAppEnvelope(strategy.address, amount, payload);

    const burnBody = buildBurnBody({
      burnToken: usdc.address,
      mintRecipient: adapter.address,
      amount,
      msgSender: adapter.address, // peer adapter under CREATE3 parity
      feeExecuted,
      hookData,
    });
    const message = buildTransportMessage({
      sourceDomain: SOURCE_DOMAIN,
      sender: tokenMessenger.address, // burn message — transport sender is TokenMessenger
      recipient: tokenMessenger.address, // (destination TokenMessenger; not enforced for burns)
      body: burnBody,
    });

    const landed = amount.sub(feeExecuted);
    // feePaid is no longer forwarded to the strategy; the adapter emits it on
    // MessageDelivered for off-chain consumers. Assert the event carries feeExecuted.
    await expect(adapter.connect(operator).relay(message, "0x"))
      .to.emit(adapter, "MessageDelivered")
      .withArgs(strategy.address, usdc.address, landed, feeExecuted);

    // Strategy received exactly `amount - feeExecuted` USDC.
    expect(await strategy.callCount()).to.equal(1);
    expect(await strategy.lastSender()).to.equal(strategy.address);
    expect(await strategy.lastToken()).to.equal(usdc.address);
    expect(await strategy.lastAmount()).to.equal(landed);
    expect(await strategy.lastPayload()).to.equal(payload);
    expect(await usdc.balanceOf(strategy.address)).to.equal(landed);
    expect(await usdc.balanceOf(adapter.address)).to.equal(0);
  });

  it("isolates pre-existing residue/donation on the adapter from this op's accounting", async () => {
    // Donate 13 USDC to the adapter before the relay fires.
    const donation = ethers.utils.parseUnits("13", 6);
    await usdc.mintTo(adapter.address, donation);

    const amount = ethers.utils.parseUnits("100", 6);
    const feeExecuted = 0; // finalized, no fee
    const hookData = wrapAppEnvelope(strategy.address, amount, "0x");

    const burnBody = buildBurnBody({
      burnToken: usdc.address,
      mintRecipient: adapter.address,
      amount,
      msgSender: adapter.address, // peer adapter under CREATE3 parity
      feeExecuted,
      hookData,
    });
    const message = buildTransportMessage({
      sourceDomain: SOURCE_DOMAIN,
      sender: tokenMessenger.address,
      recipient: tokenMessenger.address,
      body: burnBody,
    });

    await adapter.connect(operator).relay(message, "0x");

    // Strategy receives exactly the operation amount — not amount + donation.
    expect(await strategy.lastAmount()).to.equal(amount);
    expect(await usdc.balanceOf(strategy.address)).to.equal(amount);
    // Donation stays on the adapter, isolated from this delivery.
    expect(await usdc.balanceOf(adapter.address)).to.equal(donation);
  });

  it("ignores the burn body's `burnToken` — always credits local USDC", async () => {
    const amount = ethers.utils.parseUnits("100", 6);
    // `burnToken` is the SOURCE-chain USDC address, which differs from this chain's
    // local USDC for a real cross-chain transfer. The adapter no longer checks it:
    // the credited token is bound to local `usdcToken` by the balanceOf-delta + the
    // hard-coded `_deliver(..., usdcToken, ...)`, so a forged source burnToken can't
    // mint anything but local USDC. The relay therefore succeeds.
    const fakeToken = "0x000000000000000000000000000000000000BAD0";
    const hookData = wrapAppEnvelope(strategy.address, amount, "0x");
    const burnBody = buildBurnBody({
      burnToken: fakeToken,
      mintRecipient: adapter.address,
      amount,
      msgSender: adapter.address, // peer adapter under CREATE3 parity
      feeExecuted: 0,
      hookData,
    });
    const message = buildTransportMessage({
      sourceDomain: SOURCE_DOMAIN,
      sender: tokenMessenger.address,
      recipient: tokenMessenger.address,
      body: burnBody,
    });

    await adapter.connect(operator).relay(message, "0x");

    // Local USDC was minted and delivered to the strategy regardless of burnToken.
    expect(await strategy.lastToken()).to.equal(usdc.address);
    expect(await strategy.lastAmount()).to.equal(amount);
    expect(await usdc.balanceOf(strategy.address)).to.equal(amount);
  });

  it("rejects when the burn body's mintRecipient is not this adapter", async () => {
    const amount = ethers.utils.parseUnits("100", 6);
    const wrongRecipient = "0x000000000000000000000000000000000000c0DE";
    const hookData = wrapAppEnvelope(strategy.address, amount, "0x");
    const burnBody = buildBurnBody({
      burnToken: usdc.address,
      mintRecipient: wrongRecipient, // not this adapter (CREATE3 parity broken)
      amount,
      msgSender: adapter.address, // peer adapter under CREATE3 parity
      feeExecuted: 0,
      hookData,
    });
    const message = buildTransportMessage({
      sourceDomain: SOURCE_DOMAIN,
      sender: tokenMessenger.address,
      recipient: tokenMessenger.address,
      body: burnBody,
    });

    // The burn branch enforces mint-recipient parity (the pure-message branch checks
    // transportRecipient; the burn branch checks the burn body's mintRecipient).
    await expect(
      adapter.connect(operator).relay(message, "0x")
    ).to.be.revertedWith("CCTP: bad mint recipient");
  });

  it("rejects when envelope intendedAmount disagrees with the burn `amount`", async () => {
    const amount = ethers.utils.parseUnits("100", 6);
    const wrongIntended = ethers.utils.parseUnits("999", 6);
    const hookData = wrapAppEnvelope(strategy.address, wrongIntended, "0x");
    const burnBody = buildBurnBody({
      burnToken: usdc.address,
      mintRecipient: adapter.address,
      amount,
      msgSender: adapter.address, // peer adapter under CREATE3 parity
      feeExecuted: 0,
      hookData,
    });
    const message = buildTransportMessage({
      sourceDomain: SOURCE_DOMAIN,
      sender: tokenMessenger.address,
      recipient: tokenMessenger.address,
      body: burnBody,
    });

    await expect(
      adapter.connect(operator).relay(message, "0x")
    ).to.be.revertedWith("CCTP: intent mismatch");
  });

  it("rejects when msgSender (peer adapter under CREATE3 parity) is not authorised", async () => {
    const stranger = "0x000000000000000000000000000000000000BEEF";
    const amount = ethers.utils.parseUnits("100", 6);
    const hookData = wrapAppEnvelope(strategy.address, amount, "0x");
    const burnBody = buildBurnBody({
      burnToken: usdc.address,
      mintRecipient: adapter.address,
      amount,
      msgSender: stranger, // unauthorised peer adapter
      feeExecuted: 0,
      hookData,
    });
    const message = buildTransportMessage({
      sourceDomain: SOURCE_DOMAIN,
      sender: tokenMessenger.address,
      recipient: tokenMessenger.address,
      body: burnBody,
    });

    // _validateInbound checks `transportSender == address(this)` (peer parity). The
    // burn-path passes msgSender from the burn body as the transport identity, so this
    // surfaces the parity check failure.
    await expect(
      adapter.connect(operator).relay(message, "0x")
    ).to.be.revertedWith("Adapter: not from peer adapter");
  });

  it("rejects a burn attested below the configured finality floor", async () => {
    // Adapter wants finalised (2000, set in beforeEach); the burn is attested fast (1000).
    const amount = ethers.utils.parseUnits("100", 6);
    const hookData = wrapAppEnvelope(strategy.address, amount, "0x");
    const burnBody = buildBurnBody({
      burnToken: usdc.address,
      mintRecipient: adapter.address,
      amount,
      msgSender: adapter.address, // peer adapter under CREATE3 parity
      feeExecuted: 0,
      hookData,
    });
    const message = buildTransportMessage({
      sourceDomain: SOURCE_DOMAIN,
      sender: tokenMessenger.address,
      recipient: tokenMessenger.address,
      body: burnBody,
      finalityThresholdExecuted: 1000, // fast finality, below the 2000 floor
    });

    await expect(
      adapter.connect(operator).relay(message, "0x")
    ).to.be.revertedWith("CCTP: insufficient finality");
  });

  it("accepts a fast-finality burn when the floor allows it", async () => {
    // Lower the floor to fast finality; a burn attested at 1000 now delivers.
    await adapter.connect(governor).setMinFinalityThreshold(1000);

    const amount = ethers.utils.parseUnits("100", 6);
    const hookData = wrapAppEnvelope(strategy.address, amount, "0x");
    const burnBody = buildBurnBody({
      burnToken: usdc.address,
      mintRecipient: adapter.address,
      amount,
      msgSender: adapter.address, // peer adapter under CREATE3 parity
      feeExecuted: 0,
      hookData,
    });
    const message = buildTransportMessage({
      sourceDomain: SOURCE_DOMAIN,
      sender: tokenMessenger.address,
      recipient: tokenMessenger.address,
      body: burnBody,
      finalityThresholdExecuted: 1000,
    });

    await expect(adapter.connect(operator).relay(message, "0x")).to.emit(
      adapter,
      "MessageDelivered"
    );
    expect(await usdc.balanceOf(strategy.address)).to.equal(amount);
  });
});
