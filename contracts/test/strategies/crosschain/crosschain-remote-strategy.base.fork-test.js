const { expect } = require("chai");

const { isCI, usdcUnits } = require("../../helpers");
const { createFixtureLoader } = require("../../_fixture");
const { crossChainFixture } = require("../../_fixture-base");
const {
  MESSAGE_SENT_EVENT_TOPIC,
  decodeMessageSentEvent,
  decodeBalanceCheckMessageBody,
  replaceMessageTransmitter,
  encodeBurnMessageBody,
  decodeBurnMessageBody,
  encodeCCTPMessage,
  encodeDepositMessageBody,
  encodeWithdrawMessageBody,
} = require("./_crosschain-helpers");
const addresses = require("../../../utils/addresses");

const loadFixture = createFixtureLoader(crossChainFixture);

describe("ForkTest: CrossChainRemoteStrategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  const verifyBalanceCheckMessage = (
    messageSentEvent,
    expectedNonce,
    expectedBalance,
    transferAmount = "0"
  ) => {
    const { crossChainRemoteStrategy, usdc } = fixture;
    const {
      version,
      sourceDomain,
      desinationDomain,
      sender,
      recipient,
      destinationCaller,
      minFinalityThreshold,
      payload,
    } = decodeMessageSentEvent(messageSentEvent);

    expect(version).to.eq(1);
    expect(sourceDomain).to.eq(6);
    expect(desinationDomain).to.eq(0);
    expect(destinationCaller.toLowerCase()).to.eq(
      crossChainRemoteStrategy.address.toLowerCase()
    );
    expect(minFinalityThreshold).to.eq(2000);

    let balanceCheckPayload = payload;

    const isBurnMessage =
      sender.toLowerCase() == addresses.CCTPTokenMessengerV2.toLowerCase();
    if (isBurnMessage) {
      // Verify burn message
      const { burnToken, recipient, amount, sender, hookData } =
        decodeBurnMessageBody(payload);
      expect(burnToken.toLowerCase()).to.eq(usdc.address.toLowerCase());
      expect(recipient.toLowerCase()).to.eq(
        crossChainRemoteStrategy.address.toLowerCase()
      );
      expect(amount).to.eq(transferAmount);
      expect(sender.toLowerCase()).to.eq(
        crossChainRemoteStrategy.address.toLowerCase()
      );
      balanceCheckPayload = hookData;
    } else {
      // Ensure sender and recipient are the strategy address
      expect(sender.toLowerCase()).to.eq(
        crossChainRemoteStrategy.address.toLowerCase()
      );
      expect(recipient.toLowerCase()).to.eq(
        crossChainRemoteStrategy.address.toLowerCase()
      );
    }

    const {
      version: balanceCheckVersion,
      messageType,
      nonce,
      balance,
    } = decodeBalanceCheckMessageBody(balanceCheckPayload);

    expect(balanceCheckVersion).to.eq(1010);
    expect(messageType).to.eq(3);
    expect(nonce).to.eq(expectedNonce);
    expect(balance).to.approxEqual(expectedBalance);
  };

  it("Should send a balance update message", async function () {
    const { crossChainRemoteStrategy, strategist, rafael, usdc } = fixture;
    // Send some USDC to the remote strategy
    await usdc
      .connect(rafael)
      .transfer(crossChainRemoteStrategy.address, usdcUnits("1234"));

    const balanceBefore = await crossChainRemoteStrategy.checkBalance(
      usdc.address
    );
    const nonceBefore = await crossChainRemoteStrategy.lastTransferNonce();

    const tx = await crossChainRemoteStrategy
      .connect(strategist)
      .sendBalanceUpdate();
    const receipt = await tx.wait();
    const messageSentEvent = receipt.events.find((e) =>
      e.topics.includes(MESSAGE_SENT_EVENT_TOPIC)
    );

    verifyBalanceCheckMessage(
      messageSentEvent,
      nonceBefore.toNumber(),
      balanceBefore
    );
  });

  it("Should handle deposits", async function () {
    const { crossChainRemoteStrategy, strategist, rafael, usdc } = fixture;

    // snapshot state
    const balanceBefore = await crossChainRemoteStrategy.checkBalance(
      usdc.address
    );
    const nonceBefore = await crossChainRemoteStrategy.lastTransferNonce();

    const depositAmount = usdcUnits("1234.56");

    // Replace transmitter to mock transmitter
    await replaceMessageTransmitter();

    const nextNonce = nonceBefore.toNumber() + 1;

    // Build deposit message
    const depositPayload = encodeDepositMessageBody(nextNonce, depositAmount);
    const burnPayload = encodeBurnMessageBody(
      crossChainRemoteStrategy.address,
      crossChainRemoteStrategy.address,
      addresses.mainnet.USDC,
      depositAmount,
      depositPayload
    );
    const message = encodeCCTPMessage(
      0,
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPTokenMessengerV2,
      burnPayload
    );

    // Simulate token transfer
    await usdc
      .connect(rafael)
      .transfer(crossChainRemoteStrategy.address, depositAmount);

    // Relay the message
    const tx = await crossChainRemoteStrategy
      .connect(strategist)
      .relay(message, "0x");

    // Check if it sent the check balance message
    const receipt = await tx.wait();
    const messageSentEvent = receipt.events.find((e) =>
      e.topics.includes(MESSAGE_SENT_EVENT_TOPIC)
    );

    // Verify the balance check message
    const expectedBalance = balanceBefore.add(depositAmount);
    verifyBalanceCheckMessage(messageSentEvent, nextNonce, expectedBalance);

    const nonceAfter = await crossChainRemoteStrategy.lastTransferNonce();
    expect(nonceAfter).to.eq(nextNonce);

    const balanceAfter = await crossChainRemoteStrategy.checkBalance(
      usdc.address
    );
    expect(balanceAfter).to.approxEqual(expectedBalance);
  });

  it("Should handle withdrawals", async function () {
    const { crossChainRemoteStrategy, strategist, rafael, usdc } = fixture;

    const withdrawalAmount = usdcUnits("1234.56");

    // Make sure the strategy has enough balance
    const depositAmount = withdrawalAmount.mul(2);
    await usdc
      .connect(rafael)
      .transfer(crossChainRemoteStrategy.address, depositAmount);
    await crossChainRemoteStrategy
      .connect(strategist)
      .deposit(usdc.address, depositAmount);

    // snapshot state
    const balanceBefore = await crossChainRemoteStrategy.checkBalance(
      usdc.address
    );
    const nonceBefore = await crossChainRemoteStrategy.lastTransferNonce();
    const nextNonce = nonceBefore.toNumber() + 1;

    // Build withdrawal message
    const withdrawalPayload = encodeWithdrawMessageBody(
      nextNonce,
      withdrawalAmount
    );
    const message = encodeCCTPMessage(
      0,
      crossChainRemoteStrategy.address,
      crossChainRemoteStrategy.address,
      withdrawalPayload
    );

    // Replace transmitter to mock transmitter
    await replaceMessageTransmitter();

    // Relay the message
    const tx = await crossChainRemoteStrategy
      .connect(strategist)
      .relay(message, "0x");

    // Check if it sent the check balance message
    const receipt = await tx.wait();
    const messageSentEvent = receipt.events.find((e) =>
      e.topics.includes(MESSAGE_SENT_EVENT_TOPIC)
    );

    // Verify the balance check message
    const expectedBalance = balanceBefore.sub(withdrawalAmount);
    verifyBalanceCheckMessage(
      messageSentEvent,
      nextNonce,
      expectedBalance,
      withdrawalAmount
    );

    const nonceAfter = await crossChainRemoteStrategy.lastTransferNonce();
    expect(nonceAfter).to.eq(nextNonce);

    const balanceAfter = await crossChainRemoteStrategy.checkBalance(
      usdc.address
    );
    expect(balanceAfter).to.approxEqual(expectedBalance);
  });

  it("Should revert if the burn token is not peer USDC", async function () {
    const { crossChainRemoteStrategy, strategist } = fixture;

    const nonceBefore = await crossChainRemoteStrategy.lastTransferNonce();

    const depositAmount = usdcUnits("1234.56");

    // Replace transmitter to mock transmitter
    await replaceMessageTransmitter();

    const nextNonce = nonceBefore.toNumber() + 1;

    // Build deposit message
    const depositPayload = encodeDepositMessageBody(nextNonce, depositAmount);
    const burnPayload = encodeBurnMessageBody(
      crossChainRemoteStrategy.address,
      crossChainRemoteStrategy.address,
      addresses.base.WETH, // Not peer USDC
      depositAmount,
      depositPayload
    );
    const message = encodeCCTPMessage(
      0,
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPTokenMessengerV2,
      burnPayload
    );

    // Relay the message
    const tx = crossChainRemoteStrategy
      .connect(strategist)
      .relay(message, "0x");

    await expect(tx).to.be.revertedWith("Invalid burn token");
  });
});
