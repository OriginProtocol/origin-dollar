const { expect } = require("chai");

const { usdcUnits, isCI } = require("../../helpers");
const { createFixtureLoader, crossChainFixture } = require("../../_fixture");
const { impersonateAndFund } = require("../../../utils/signers");
const addresses = require("../../../utils/addresses");
const loadFixture = createFixtureLoader(crossChainFixture);
const {
  DEPOSIT_FOR_BURN_EVENT_TOPIC,
  MESSAGE_SENT_EVENT_TOPIC,
  setRemoteStrategyBalance,
  decodeDepositForBurnEvent,
  decodeMessageSentEvent,
  decodeDepositOrWithdrawMessage,
  encodeCCTPMessage,
  encodeBurnMessageBody,
  encodeBalanceCheckMessageBody,
  replaceMessageTransmitter,
} = require("./_crosschain-helpers");

describe("ForkTest: CrossChainMasterStrategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Message sending", function () {
    it("Should initiate bridging of deposited USDC", async function () {
      const { matt, crossChainMasterStrategy, usdc } = fixture;

      if (await crossChainMasterStrategy.isTransferPending()) {
        // Skip if there's a pending transfer
        console.log(
          "Skipping deposit fork test because there's a pending transfer"
        );
        return;
      }

      const vaultAddr = await crossChainMasterStrategy.vaultAddress();

      const impersonatedVault = await impersonateAndFund(vaultAddr);

      // Let the strategy hold some USDC
      await usdc
        .connect(matt)
        .transfer(crossChainMasterStrategy.address, usdcUnits("1000"));

      const usdcBalanceBefore = await usdc.balanceOf(
        crossChainMasterStrategy.address
      );
      const strategyBalanceBefore = await crossChainMasterStrategy.checkBalance(
        usdc.address
      );

      // Simulate deposit call
      const tx = await crossChainMasterStrategy
        .connect(impersonatedVault)
        .deposit(usdc.address, usdcUnits("1000"));

      const usdcBalanceAfter = await usdc.balanceOf(
        crossChainMasterStrategy.address
      );
      expect(usdcBalanceAfter).to.eq(usdcBalanceBefore.sub(usdcUnits("1000")));

      const strategyBalanceAfter = await crossChainMasterStrategy.checkBalance(
        usdc.address
      );
      expect(strategyBalanceAfter).to.eq(strategyBalanceBefore);

      expect(await crossChainMasterStrategy.pendingAmount()).to.eq(
        usdcUnits("1000")
      );

      // Check for message sent event
      const receipt = await tx.wait();
      const depositForBurnEvent = receipt.events.find((e) =>
        e.topics.includes(DEPOSIT_FOR_BURN_EVENT_TOPIC)
      );
      const burnEventData = decodeDepositForBurnEvent(depositForBurnEvent);

      expect(burnEventData.amount).to.eq(usdcUnits("1000"));
      expect(burnEventData.mintRecipient.toLowerCase()).to.eq(
        crossChainMasterStrategy.address.toLowerCase()
      );
      expect(burnEventData.destinationDomain).to.eq(6);
      expect(burnEventData.destinationTokenMessenger.toLowerCase()).to.eq(
        addresses.CCTPTokenMessengerV2.toLowerCase()
      );
      expect(burnEventData.destinationCaller.toLowerCase()).to.eq(
        crossChainMasterStrategy.address.toLowerCase()
      );
      expect(burnEventData.maxFee).to.eq(0);
      expect(burnEventData.burnToken).to.eq(usdc.address);

      expect(burnEventData.depositer.toLowerCase()).to.eq(
        crossChainMasterStrategy.address.toLowerCase()
      );
      expect(burnEventData.minFinalityThreshold).to.eq(2000);
      expect(burnEventData.burnToken.toLowerCase()).to.eq(
        usdc.address.toLowerCase()
      );

      // Decode and verify payload
      const { messageType, nonce, amount } = decodeDepositOrWithdrawMessage(
        burnEventData.hookData
      );
      expect(messageType).to.eq(1);
      expect(nonce).to.eq(1);
      expect(amount).to.eq(usdcUnits("1000"));
    });

    it("Should request withdrawal", async function () {
      const { crossChainMasterStrategy, usdc } = fixture;

      if (await crossChainMasterStrategy.isTransferPending()) {
        // Skip if there's a pending transfer
        console.log(
          "Skipping deposit fork test because there's a pending transfer"
        );
        return;
      }

      const vaultAddr = await crossChainMasterStrategy.vaultAddress();
      const impersonatedVault = await impersonateAndFund(vaultAddr);

      // set an arbitrary remote strategy balance
      await setRemoteStrategyBalance(
        crossChainMasterStrategy,
        usdcUnits("1000")
      );

      const tx = await crossChainMasterStrategy
        .connect(impersonatedVault)
        .withdraw(vaultAddr, usdc.address, usdcUnits("1000"));
      const receipt = await tx.wait();
      const messageSentEvent = receipt.events.find((e) =>
        e.topics.includes(MESSAGE_SENT_EVENT_TOPIC)
      );

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
      expect(sourceDomain).to.eq(0);
      expect(desinationDomain).to.eq(6);
      expect(sender.toLowerCase()).to.eq(
        crossChainMasterStrategy.address.toLowerCase()
      );
      expect(recipient.toLowerCase()).to.eq(
        crossChainMasterStrategy.address.toLowerCase()
      );
      expect(destinationCaller.toLowerCase()).to.eq(
        crossChainMasterStrategy.address.toLowerCase()
      );
      expect(minFinalityThreshold).to.eq(2000);

      // Decode and verify payload
      const { messageType, nonce, amount } =
        decodeDepositOrWithdrawMessage(payload);
      expect(messageType).to.eq(2);
      expect(nonce).to.eq(1);
      expect(amount).to.eq(usdcUnits("1000"));
    });
  });

  describe("Message receiving", function () {
    it("Should handle balance check message", async function () {
      const { crossChainMasterStrategy, strategist } = fixture;

      if (await crossChainMasterStrategy.isTransferPending()) {
        // Skip if there's a pending transfer
        console.log(
          "Skipping balance check message fork test because there's a pending transfer"
        );
        return;
      }

      const lastNonce = (
        await crossChainMasterStrategy.lastTransferNonce()
      ).toNumber();

      // Replace transmitter to mock transmitter
      await replaceMessageTransmitter();

      // Build check balance payload
      const balancePayload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("12345"),
        false
      );
      const message = encodeCCTPMessage(
        6,
        crossChainMasterStrategy.address,
        crossChainMasterStrategy.address,
        balancePayload
      );

      // Relay the message with fake attestation
      await crossChainMasterStrategy.connect(strategist).relay(message, "0x");

      const remoteStrategyBalance =
        await crossChainMasterStrategy.remoteStrategyBalance();
      expect(remoteStrategyBalance).to.eq(usdcUnits("12345"));
    });

    it("Should handle balance check message for a pending deposit", async function () {
      const { crossChainMasterStrategy, strategist, usdc, matt } = fixture;

      if (await crossChainMasterStrategy.isTransferPending()) {
        // Skip if there's a pending transfer
        console.log(
          "Skipping balance check message fork test because there's a pending transfer"
        );
        return;
      }

      // Do a pre-deposit
      const vaultAddr = await crossChainMasterStrategy.vaultAddress();

      const impersonatedVault = await impersonateAndFund(vaultAddr);

      // Let the strategy hold some USDC
      await usdc
        .connect(matt)
        .transfer(crossChainMasterStrategy.address, usdcUnits("1000"));

      // Simulate deposit call
      await crossChainMasterStrategy
        .connect(impersonatedVault)
        .deposit(usdc.address, usdcUnits("1000"));

      const lastNonce = (
        await crossChainMasterStrategy.lastTransferNonce()
      ).toNumber();

      // Replace transmitter to mock transmitter
      await replaceMessageTransmitter();

      // Build check balance payload
      const payload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("10000"),
        true // deposit confirmation
      );
      const message = encodeCCTPMessage(
        6,
        crossChainMasterStrategy.address,
        crossChainMasterStrategy.address,
        payload
      );

      // Relay the message with fake attestation
      await crossChainMasterStrategy.connect(strategist).relay(message, "0x");

      const remoteStrategyBalance =
        await crossChainMasterStrategy.remoteStrategyBalance();
      // We did a deposit of 1000 USDC but had the remote strategy report 10k for the test.
      expect(remoteStrategyBalance).to.eq(usdcUnits("10000"));

      expect(await crossChainMasterStrategy.pendingAmount()).to.eq(
        usdcUnits("0")
      );
    });

    it("Should accept tokens for a pending withdrawal", async function () {
      const { crossChainMasterStrategy, strategist, matt, usdc } = fixture;

      if (await crossChainMasterStrategy.isTransferPending()) {
        // Skip if there's a pending transfer
        console.log(
          "Skipping balance check message fork test because there's a pending transfer"
        );
        return;
      }

      const vaultAddr = await crossChainMasterStrategy.vaultAddress();
      const impersonatedVault = await impersonateAndFund(vaultAddr);

      // set an arbitrary remote strategy balance
      await setRemoteStrategyBalance(
        crossChainMasterStrategy,
        usdcUnits("123456")
      );

      // Simulate withdrawal call
      await crossChainMasterStrategy
        .connect(impersonatedVault)
        .withdraw(vaultAddr, usdc.address, usdcUnits("1000"));

      const lastNonce = (
        await crossChainMasterStrategy.lastTransferNonce()
      ).toNumber();

      // Replace transmitter to mock transmitter
      await replaceMessageTransmitter();

      // Build check balance payload
      const balancePayload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("12345"),
        true // withdrawal confirmation
      );
      const burnPayload = encodeBurnMessageBody(
        crossChainMasterStrategy.address,
        crossChainMasterStrategy.address,
        addresses.base.USDC,
        usdcUnits("2342"),
        balancePayload
      );
      const message = encodeCCTPMessage(
        6,
        addresses.CCTPTokenMessengerV2,
        addresses.CCTPTokenMessengerV2,
        burnPayload
      );

      // transfer some USDC to master strategy
      await usdc
        .connect(matt)
        .transfer(crossChainMasterStrategy.address, usdcUnits("2342"));

      // Relay the message with fake attestation
      await crossChainMasterStrategy.connect(strategist).relay(message, "0x");

      const remoteStrategyBalance =
        await crossChainMasterStrategy.remoteStrategyBalance();
      expect(remoteStrategyBalance).to.eq(usdcUnits("12345"));
    });

    it("Should ignore balance check message for a pending withdrawal", async function () {
      const { crossChainMasterStrategy, strategist, usdc } = fixture;

      if (await crossChainMasterStrategy.isTransferPending()) {
        // Skip if there's a pending transfer
        console.log(
          "Skipping balance check message fork test because there's a pending transfer"
        );
        return;
      }

      const vaultAddr = await crossChainMasterStrategy.vaultAddress();
      const impersonatedVault = await impersonateAndFund(vaultAddr);

      // set an arbitrary remote strategy balance
      await setRemoteStrategyBalance(
        crossChainMasterStrategy,
        usdcUnits("1000")
      );

      const remoteStrategyBalanceBefore =
        await crossChainMasterStrategy.remoteStrategyBalance();

      // Simulate withdrawal call
      await crossChainMasterStrategy
        .connect(impersonatedVault)
        .withdraw(vaultAddr, usdc.address, usdcUnits("1000"));

      const lastNonce = (
        await crossChainMasterStrategy.lastTransferNonce()
      ).toNumber();

      // Replace transmitter to mock transmitter
      await replaceMessageTransmitter();

      // Build check balance payload
      const payload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("10000"),
        false
      );
      const message = encodeCCTPMessage(
        6,
        crossChainMasterStrategy.address,
        crossChainMasterStrategy.address,
        payload
      );

      // Relay the message with fake attestation
      await crossChainMasterStrategy.connect(strategist).relay(message, "0x");

      // Should've ignore the message
      const remoteStrategyBalance =
        await crossChainMasterStrategy.remoteStrategyBalance();
      expect(remoteStrategyBalance).to.eq(remoteStrategyBalanceBefore);
    });

    it("Should ignore balance check message with older nonce", async function () {
      const { crossChainMasterStrategy, strategist, matt, usdc } = fixture;

      if (await crossChainMasterStrategy.isTransferPending()) {
        // Skip if there's a pending transfer
        console.log(
          "Skipping balance check message fork test because there's a pending transfer"
        );
        return;
      }

      const lastNonce = (
        await crossChainMasterStrategy.lastTransferNonce()
      ).toNumber();

      // Do a pre-deposit
      const vaultAddr = await crossChainMasterStrategy.vaultAddress();

      const impersonatedVault = await impersonateAndFund(vaultAddr);

      // Let the strategy hold some USDC
      await usdc
        .connect(matt)
        .transfer(crossChainMasterStrategy.address, usdcUnits("1000"));

      // Simulate deposit call
      await crossChainMasterStrategy
        .connect(impersonatedVault)
        .deposit(usdc.address, usdcUnits("1000"));

      const remoteStrategyBalanceBefore =
        await crossChainMasterStrategy.remoteStrategyBalance();

      // Replace transmitter to mock transmitter
      await replaceMessageTransmitter();

      // Build check balance payload
      const payload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("123244"),
        false // deposit confirmation
      );
      const message = encodeCCTPMessage(
        6,
        crossChainMasterStrategy.address,
        crossChainMasterStrategy.address,
        payload
      );

      // Relay the message with fake attestation
      await crossChainMasterStrategy.connect(strategist).relay(message, "0x");

      const remoteStrategyBalance =
        await crossChainMasterStrategy.remoteStrategyBalance();
      expect(remoteStrategyBalance).to.eq(remoteStrategyBalanceBefore);
    });

    it("Should ignore if nonce is higher", async function () {
      const { crossChainMasterStrategy, strategist } = fixture;

      if (await crossChainMasterStrategy.isTransferPending()) {
        // Skip if there's a pending transfer
        console.log(
          "Skipping balance check message fork test because there's a pending transfer"
        );
        return;
      }

      const lastNonce = (
        await crossChainMasterStrategy.lastTransferNonce()
      ).toNumber();

      // Replace transmitter to mock transmitter
      await replaceMessageTransmitter();

      const remoteStrategyBalanceBefore =
        await crossChainMasterStrategy.remoteStrategyBalance();

      // Build check balance payload
      const payload = encodeBalanceCheckMessageBody(
        lastNonce + 2,
        usdcUnits("123244"),
        false
      );
      const message = encodeCCTPMessage(
        6,
        crossChainMasterStrategy.address,
        crossChainMasterStrategy.address,
        payload
      );

      // Relay the message with fake attestation
      await crossChainMasterStrategy.connect(strategist).relay(message, "0x");
      const remoteStrategyBalanceAfter =
        await crossChainMasterStrategy.remoteStrategyBalance();
      expect(remoteStrategyBalanceAfter).to.eq(remoteStrategyBalanceBefore);
    });

    it("Should revert if the burn token is not peer USDC", async function () {
      const { crossChainMasterStrategy, strategist } = fixture;

      if (await crossChainMasterStrategy.isTransferPending()) {
        // Skip if there's a pending transfer
        console.log(
          "Skipping balance check message fork test because there's a pending transfer"
        );
        return;
      }

      // set an arbitrary remote strategy balance
      await setRemoteStrategyBalance(
        crossChainMasterStrategy,
        usdcUnits("123456")
      );

      const lastNonce = (
        await crossChainMasterStrategy.lastTransferNonce()
      ).toNumber();

      // Replace transmitter to mock transmitter
      await replaceMessageTransmitter();

      // Build check balance payload
      const balancePayload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("12345"),
        true // withdrawal confirmation
      );
      const burnPayload = encodeBurnMessageBody(
        crossChainMasterStrategy.address,
        crossChainMasterStrategy.address,
        addresses.mainnet.WETH, // Not peer USDC
        usdcUnits("2342"),
        balancePayload
      );
      const message = encodeCCTPMessage(
        6,
        addresses.CCTPTokenMessengerV2,
        addresses.CCTPTokenMessengerV2,
        burnPayload
      );

      // Relay the message with fake attestation
      const tx = crossChainMasterStrategy
        .connect(strategist)
        .relay(message, "0x");

      await expect(tx).to.be.revertedWith("Invalid burn token");
    });
  });
});
