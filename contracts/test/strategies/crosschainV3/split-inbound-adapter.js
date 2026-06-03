const { expect } = require("chai");
const { ethers } = require("hardhat");
const { impersonateAndFund } = require("../../../utils/signers");

const MSG = {
  YIELD_DEPOSIT_ACK: 2,
  WITHDRAW_CLAIM_ACK: 6,
};

/**
 * Unit coverage for SuperbridgeCCIPInboundAdapter exact-amount delivery semantics
 * and multi-tenant per-peer routing.
 *
 * Split delivery means the CCIP message and the canonical-bridge tokens arrive in
 * separate transactions. The adapter must:
 *   1. Resolve the destination strategy from (sourceChainSelector, sender) and reject
 *      messages from unknown peers.
 *   2. Match the right message type as token-carrying (WITHDRAW_CLAIM_ACK).
 *   3. Decode the exact expected amount from the payload.
 *   4. Hold the message in the right strategy's pending slot until tokens land.
 *   5. processStoredMessage(strategy) delivers exactly `amount` to that strategy.
 *   6. Two strategies served by the same adapter don't interfere with each other.
 */
describe("Unit: SuperbridgeCCIPInboundAdapter split delivery", function () {
  let governor, peerOutbound, otherPeer;
  let receiver, strategy, expectedToken;

  // Ethereum CCIP selector — `BigNumber.from(string)` avoids the BigInt literal
  // syntax (`n` suffix) that eslint refuses to parse in this repo.
  const PEER_CHAIN = ethers.BigNumber.from("5009297550715157269");

  // Build the CCIP message struct (Client.Any2EVMMessage)
  function buildAny2EvmMessage({
    messageId = ethers.utils.hexZeroPad("0x1", 32),
    sender,
    data,
    destTokenAmounts = [],
  }) {
    return {
      messageId,
      sourceChainSelector: PEER_CHAIN,
      sender: ethers.utils.defaultAbiCoder.encode(["address"], [sender]),
      data,
      destTokenAmounts,
    };
  }

  function wrapEnvelope(messageType, nonce, payload) {
    return ethers.utils.solidityPack(
      ["uint32", "uint32", "uint64", "bytes"],
      [2010, messageType, nonce, payload]
    );
  }

  function encodeClaimAckPayload(newBalance, success, amount) {
    return ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bool", "uint256"],
      [newBalance, success, amount]
    );
  }

  beforeEach(async () => {
    [governor, peerOutbound, otherPeer] = await ethers.getSigners();

    // Mock CCIP router (we'll impersonate it to call ccipReceive directly).
    const RouterFactory = await ethers.getContractFactory("MockCCIPRouter");
    const router = await RouterFactory.connect(governor).deploy();

    // The "expected token" arriving via the canonical bridge. Use a basic ERC20.
    const ERC20Factory = await ethers.getContractFactory("MockUSDC");
    expectedToken = await ERC20Factory.connect(governor).deploy();

    const ReceiverFactory = await ethers.getContractFactory(
      "SuperbridgeCCIPInboundAdapter"
    );
    receiver = await ReceiverFactory.connect(governor).deploy(
      router.address,
      expectedToken.address
    );

    const StrategyFactory = await ethers.getContractFactory(
      "MockBridgeReceiver"
    );
    strategy = await StrategyFactory.connect(governor).deploy();

    await receiver
      .connect(governor)
      .registerPeer(PEER_CHAIN, peerOutbound.address, strategy.address);
  });

  it("WITHDRAW_CLAIM_ACK with tokens already on adapter delivers atomically", async () => {
    const amount = ethers.utils.parseUnits("100", 6);
    const newBalance = ethers.utils.parseUnits("900", 6);

    // Pre-position the tokens (simulate canonical bridge having already landed).
    await expectedToken.mintTo(receiver.address, amount);

    const data = wrapEnvelope(
      MSG.WITHDRAW_CLAIM_ACK,
      42,
      encodeClaimAckPayload(newBalance, true, amount)
    );

    // Impersonate the CCIP router and call ccipReceive.
    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver
      .connect(sRouter)
      .ccipReceive(buildAny2EvmMessage({ sender: peerOutbound.address, data }));

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.callCount()).to.equal(1);
    expect(await strategy.lastAmount()).to.equal(amount);
    expect(await strategy.lastMessageType()).to.equal(MSG.WITHDRAW_CLAIM_ACK);
    expect(await expectedToken.balanceOf(strategy.address)).to.equal(amount);
    expect(await expectedToken.balanceOf(receiver.address)).to.equal(0);
  });

  it("WITHDRAW_CLAIM_ACK message-first: stores until tokens land, then exact delivery", async () => {
    const amount = ethers.utils.parseUnits("250", 6);
    const data = wrapEnvelope(
      MSG.WITHDRAW_CLAIM_ACK,
      7,
      encodeClaimAckPayload(0, true, amount)
    );

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver
      .connect(sRouter)
      .ccipReceive(buildAny2EvmMessage({ sender: peerOutbound.address, data }));

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(true);
    expect(await strategy.callCount()).to.equal(0);

    // Process before tokens — must revert.
    await expect(
      receiver.processStoredMessage(strategy.address)
    ).to.be.revertedWith("Adapter: tokens not yet landed");

    // Tokens arrive (canonical bridge mint to receiver). Then donate one extra wei to
    // confirm the receiver delivers exactly `amount` rather than the full balance.
    await expectedToken.mintTo(receiver.address, amount.add(1));

    await receiver.processStoredMessage(strategy.address);

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.callCount()).to.equal(1);
    expect(await strategy.lastAmount()).to.equal(amount);
    expect(await expectedToken.balanceOf(strategy.address)).to.equal(amount);
    // The donated wei stays on the adapter.
    expect(await expectedToken.balanceOf(receiver.address)).to.equal(1);
  });

  it("NACK (success=false) is message-only — no token leg expected", async () => {
    const data = wrapEnvelope(
      MSG.WITHDRAW_CLAIM_ACK,
      11,
      encodeClaimAckPayload(123, false, 0)
    );

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver
      .connect(sRouter)
      .ccipReceive(buildAny2EvmMessage({ sender: peerOutbound.address, data }));

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.callCount()).to.equal(1);
    expect(await strategy.lastAmount()).to.equal(0);
  });

  it("YIELD_DEPOSIT_ACK (other R→M msg) is message-only — never reserves a token leg", async () => {
    const data = wrapEnvelope(
      MSG.YIELD_DEPOSIT_ACK,
      3,
      ethers.utils.defaultAbiCoder.encode(["uint256"], [42])
    );

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver
      .connect(sRouter)
      .ccipReceive(buildAny2EvmMessage({ sender: peerOutbound.address, data }));

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.lastAmount()).to.equal(0);
    expect(await strategy.lastMessageType()).to.equal(MSG.YIELD_DEPOSIT_ACK);
  });

  it("rejects messages from unauthorised CCIP source/sender", async () => {
    const data = wrapEnvelope(
      MSG.WITHDRAW_CLAIM_ACK,
      1,
      encodeClaimAckPayload(0, false, 0)
    );

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    // Sender that's not a registered peer.
    await expect(
      receiver
        .connect(sRouter)
        .ccipReceive(buildAny2EvmMessage({ sender: governor.address, data }))
    ).to.be.revertedWith("SuperIn: unknown peer");

    // Direct call from a non-router caller.
    await expect(
      receiver
        .connect(governor)
        .ccipReceive(
          buildAny2EvmMessage({ sender: peerOutbound.address, data })
        )
    ).to.be.revertedWith("SuperIn: not router");
  });

  it("multi-tenant: one adapter routes messages to distinct strategies by peer", async () => {
    // Register a second peer → a second strategy on the same adapter.
    const StrategyFactory = await ethers.getContractFactory(
      "MockBridgeReceiver"
    );
    const strategy2 = await StrategyFactory.connect(governor).deploy();
    await receiver
      .connect(governor)
      .registerPeer(PEER_CHAIN, otherPeer.address, strategy2.address);

    const amount1 = ethers.utils.parseUnits("100", 6);
    const amount2 = ethers.utils.parseUnits("250", 6);
    const sRouter = await impersonateAndFund(await receiver.ccipRouter());

    // Send claim-ack messages for both tenants without prepositioning tokens — both end
    // up in their respective pending slots simultaneously.
    await receiver.connect(sRouter).ccipReceive(
      buildAny2EvmMessage({
        sender: peerOutbound.address,
        data: wrapEnvelope(
          MSG.WITHDRAW_CLAIM_ACK,
          11,
          encodeClaimAckPayload(0, true, amount1)
        ),
      })
    );
    await receiver.connect(sRouter).ccipReceive(
      buildAny2EvmMessage({
        sender: otherPeer.address,
        data: wrapEnvelope(
          MSG.WITHDRAW_CLAIM_ACK,
          22,
          encodeClaimAckPayload(0, true, amount2)
        ),
      })
    );

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(true);
    expect(await receiver.hasPendingMessage(strategy2.address)).to.equal(true);

    // Fund tokens for the SECOND tenant first and process it — confirms slots don't
    // collide and tokens credit the right strategy.
    await expectedToken.mintTo(receiver.address, amount2);
    await receiver.processStoredMessage(strategy2.address);
    expect(await receiver.hasPendingMessage(strategy2.address)).to.equal(false);
    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(true);
    expect(await strategy2.lastAmount()).to.equal(amount2);
    expect(await expectedToken.balanceOf(strategy2.address)).to.equal(amount2);
    expect(await strategy.callCount()).to.equal(0);

    // Now fund and process the first tenant.
    await expectedToken.mintTo(receiver.address, amount1);
    await receiver.processStoredMessage(strategy.address);
    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.lastAmount()).to.equal(amount1);
    expect(await expectedToken.balanceOf(strategy.address)).to.equal(amount1);
  });
});
