const { expect } = require("chai");
const { ethers } = require("hardhat");
const { impersonateAndFund } = require("../../../utils/signers");

const MSG = {
  DEPOSIT_ACK: 2,
  WITHDRAW_CLAIM_ACK: 6,
};

/**
 * Unit coverage for SuperbridgeAdapter exact-amount delivery semantics
 * and multi-tenant routing via the envelope-sender whitelist.
 *
 * Split delivery means the CCIP message and the canonical-bridge tokens arrive in
 * separate transactions. The adapter must:
 *   1. Extract the source strategy address from the envelope header (CREATE2 parity:
 *      the same address is the destination on this chain). Reject envelopes whose
 *      sender isn't on the whitelist.
 *   2. Identify which message types carry tokens (WITHDRAW_CLAIM_ACK is the only one).
 *   3. Decode the exact expected amount from the payload.
 *   4. Hold the message in the per-target pending slot until tokens land.
 *   5. processStoredMessage(target) delivers exactly `amount` to that target.
 *   6. Two strategies served by the same adapter don't interfere with each other.
 */
describe("Unit: SuperbridgeAdapter split delivery", function () {
  let governor, routerSigner, otherSigner;
  let receiver, strategy, strategy2, expectedToken;

  // Ethereum CCIP selector — `BigNumber.from(string)` avoids the BigInt literal
  // syntax (`n` suffix) that eslint refuses to parse in this repo.
  const PEER_CHAIN = ethers.BigNumber.from("5009297550715157269");

  // Build the CCIP message struct (Client.Any2EVMMessage). The transport-level
  // sender doesn't gate routing under the new design — the envelope's `sender`
  // field does — but CCIP still requires the field, so pass a random address.
  function buildAny2EvmMessage({
    messageId = ethers.utils.hexZeroPad("0x1", 32),
    transportSender = ethers.constants.AddressZero,
    data,
    destTokenAmounts = [],
  }) {
    return {
      messageId,
      sourceChainSelector: PEER_CHAIN,
      sender: ethers.utils.defaultAbiCoder.encode(
        ["address"],
        [transportSender]
      ),
      data,
      destTokenAmounts,
    };
  }

  function wrapEnvelope(messageType, nonce, envelopeSender, payload) {
    return ethers.utils.solidityPack(
      ["uint32", "uint32", "uint64", "address", "bytes"],
      [1020, messageType, nonce, envelopeSender, payload]
    );
  }

  function encodeClaimAckPayload(newBalance, success, amount) {
    return ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bool", "uint256"],
      [newBalance, success, amount]
    );
  }

  beforeEach(async () => {
    [governor, routerSigner, otherSigner] = await ethers.getSigners();

    // Mock CCIP router (we'll impersonate it to call ccipReceive directly).
    const RouterFactory = await ethers.getContractFactory("MockCCIPRouter");
    const router = await RouterFactory.connect(governor).deploy();

    // The "expected token" arriving via the canonical bridge. Use a basic ERC20.
    const ERC20Factory = await ethers.getContractFactory("MockUSDC");
    expectedToken = await ERC20Factory.connect(governor).deploy();

    const ReceiverFactory = await ethers.getContractFactory(
      "SuperbridgeAdapter"
    );
    // Inbound-only deployment: pass address(0) for the L1StandardBridge (unused on
    // the L2 side; outbound entrypoints revert when invoked).
    receiver = await ReceiverFactory.connect(governor).deploy(
      ethers.constants.AddressZero,
      router.address,
      expectedToken.address
    );

    const StrategyFactory = await ethers.getContractFactory(
      "MockBridgeReceiver"
    );
    strategy = await StrategyFactory.connect(governor).deploy();
    strategy2 = await StrategyFactory.connect(governor).deploy();

    // Under CREATE2 parity the envelope sender == destination on this chain.
    // Authorise both strategy addresses as senders.
    await receiver.connect(governor).authorise(strategy.address);
  });

  it("WITHDRAW_CLAIM_ACK with tokens already on adapter delivers atomically", async () => {
    const amount = ethers.utils.parseUnits("100", 6);
    const newBalance = ethers.utils.parseUnits("900", 6);

    await expectedToken.mintTo(receiver.address, amount);

    const data = wrapEnvelope(
      MSG.WITHDRAW_CLAIM_ACK,
      42,
      strategy.address,
      encodeClaimAckPayload(newBalance, true, amount)
    );

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver.connect(sRouter).ccipReceive(buildAny2EvmMessage({ data }));

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
      strategy.address,
      encodeClaimAckPayload(0, true, amount)
    );

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver.connect(sRouter).ccipReceive(buildAny2EvmMessage({ data }));

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(true);
    expect(await strategy.callCount()).to.equal(0);

    await expect(
      receiver.processStoredMessage(strategy.address)
    ).to.be.revertedWith("Super: tokens not yet landed");

    // Tokens arrive (canonical bridge mint to receiver). Donate one extra wei to
    // confirm the receiver delivers exactly `amount` rather than the full balance.
    await expectedToken.mintTo(receiver.address, amount.add(1));

    await receiver.processStoredMessage(strategy.address);

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.callCount()).to.equal(1);
    expect(await strategy.lastAmount()).to.equal(amount);
    expect(await expectedToken.balanceOf(strategy.address)).to.equal(amount);
    expect(await expectedToken.balanceOf(receiver.address)).to.equal(1);
  });

  it("NACK (success=false) is message-only — no token leg expected", async () => {
    const data = wrapEnvelope(
      MSG.WITHDRAW_CLAIM_ACK,
      11,
      strategy.address,
      encodeClaimAckPayload(123, false, 0)
    );

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver.connect(sRouter).ccipReceive(buildAny2EvmMessage({ data }));

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.callCount()).to.equal(1);
    expect(await strategy.lastAmount()).to.equal(0);
  });

  it("DEPOSIT_ACK (other R→M msg) is message-only — never reserves a token leg", async () => {
    const data = wrapEnvelope(
      MSG.DEPOSIT_ACK,
      3,
      strategy.address,
      ethers.utils.defaultAbiCoder.encode(["uint256"], [42])
    );

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver.connect(sRouter).ccipReceive(buildAny2EvmMessage({ data }));

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.lastAmount()).to.equal(0);
    expect(await strategy.lastMessageType()).to.equal(MSG.DEPOSIT_ACK);
  });

  it("rejects an envelope whose sender is not whitelisted", async () => {
    const data = wrapEnvelope(
      MSG.WITHDRAW_CLAIM_ACK,
      1,
      otherSigner.address, // not authorised
      encodeClaimAckPayload(0, false, 0)
    );

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await expect(
      receiver.connect(sRouter).ccipReceive(buildAny2EvmMessage({ data }))
    ).to.be.revertedWith("Adapter: not authorised");

    // Direct call from a non-router caller is still rejected at the modifier.
    const authData = wrapEnvelope(
      MSG.WITHDRAW_CLAIM_ACK,
      1,
      strategy.address,
      encodeClaimAckPayload(0, false, 0)
    );
    await expect(
      receiver
        .connect(routerSigner)
        .ccipReceive(buildAny2EvmMessage({ data: authData }))
    ).to.be.revertedWith("Super: not router");
  });

  it("multi-tenant: one adapter routes messages to distinct targets by envelope sender", async () => {
    // Authorise the second target.
    await receiver.connect(governor).authorise(strategy2.address);

    const amount1 = ethers.utils.parseUnits("100", 6);
    const amount2 = ethers.utils.parseUnits("250", 6);
    const sRouter = await impersonateAndFund(await receiver.ccipRouter());

    await receiver.connect(sRouter).ccipReceive(
      buildAny2EvmMessage({
        data: wrapEnvelope(
          MSG.WITHDRAW_CLAIM_ACK,
          11,
          strategy.address,
          encodeClaimAckPayload(0, true, amount1)
        ),
      })
    );
    await receiver.connect(sRouter).ccipReceive(
      buildAny2EvmMessage({
        data: wrapEnvelope(
          MSG.WITHDRAW_CLAIM_ACK,
          22,
          strategy2.address,
          encodeClaimAckPayload(0, true, amount2)
        ),
      })
    );

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(true);
    expect(await receiver.hasPendingMessage(strategy2.address)).to.equal(true);

    // Fund tokens for the SECOND tenant first and process it — confirms slots don't
    // collide and tokens credit the right target.
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
