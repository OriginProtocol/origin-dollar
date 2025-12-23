const { expect } = require("chai");

const { usdcUnits, isCI } = require("../../helpers");
const { createFixtureLoader, crossChainFixture } = require("../../_fixture");
const { impersonateAndFund } = require("../../../utils/signers");
// const { formatUnits } = require("ethers/lib/utils");
const addresses = require("../../../utils/addresses");
const loadFixture = createFixtureLoader(crossChainFixture);
const { setStorageAt } = require("@nomicfoundation/hardhat-network-helpers");
const { replaceContractAt } = require("../../../utils/hardhat");

const DEPOSIT_FOR_BURN_EVENT_TOPIC =
  "0x0c8c1cbdc5190613ebd485511d4e2812cfa45eecb79d845893331fedad5130a5";
const MESSAGE_SENT_EVENT_TOPIC =
  "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036";

// const ORIGIN_MESSAGE_VERSION_HEX = "0x000003f2"; // 1010

const emptyByte = "0000";
const empty2Bytes = emptyByte.repeat(2);
const empty4Bytes = emptyByte.repeat(4);
const empty16Bytes = empty4Bytes.repeat(4);
const empty18Bytes = `${empty2Bytes}${empty16Bytes}`;
const empty20Bytes = empty4Bytes.repeat(5);

const REMOTE_STRATEGY_BALANCE_SLOT = 210;

const decodeDepositForBurnEvent = (event) => {
  const [
    amount,
    mintRecipient,
    destinationDomain,
    destinationTokenMessenger,
    destinationCaller,
    maxFee,
    hookData,
  ] = ethers.utils.defaultAbiCoder.decode(
    ["uint256", "address", "uint32", "address", "address", "uint256", "bytes"],
    event.data
  );

  const [burnToken] = ethers.utils.defaultAbiCoder.decode(
    ["address"],
    event.topics[1]
  );
  const [depositer] = ethers.utils.defaultAbiCoder.decode(
    ["address"],
    event.topics[2]
  );
  const [minFinalityThreshold] = ethers.utils.defaultAbiCoder.decode(
    ["uint256"],
    event.topics[3]
  );

  return {
    amount,
    mintRecipient,
    destinationDomain,
    destinationTokenMessenger,
    destinationCaller,
    maxFee,
    hookData,
    burnToken,
    depositer,
    minFinalityThreshold,
  };
};

const decodeMessageSentEvent = (event) => {
  const evData = event.data.slice(130); // ignore first two slots along with 0x prefix

  const version = ethers.BigNumber.from(`0x${evData.slice(0, 8)}`);
  const sourceDomain = ethers.BigNumber.from(`0x${evData.slice(8, 16)}`);
  const desinationDomain = ethers.BigNumber.from(`0x${evData.slice(16, 24)}`);
  // Ignore empty nonce from 24 to 88
  const [sender, recipient, destinationCaller] =
    ethers.utils.defaultAbiCoder.decode(
      ["address", "address", "address"],
      `0x${evData.slice(88, 280)}`
    );
  const minFinalityThreshold = ethers.BigNumber.from(
    `0x${evData.slice(280, 288)}`
  );
  // Ignore empty threshold from 288 to 296
  const payload = `0x${evData.slice(296, evData.length - 8)}`;

  return {
    version,
    sourceDomain,
    desinationDomain,
    sender,
    recipient,
    destinationCaller,
    minFinalityThreshold,
    payload,
  };
};

const decodeDepositOrWithdrawMessage = (message) => {
  message = message.slice(2); // Ignore 0x prefix

  const originMessageVersion = ethers.BigNumber.from(
    `0x${message.slice(0, 8)}`
  );
  const messageType = ethers.BigNumber.from(`0x${message.slice(8, 16)}`);
  expect(originMessageVersion).to.eq(1010);

  const [nonce, amount] = ethers.utils.defaultAbiCoder.decode(
    ["uint64", "uint256"],
    `0x${message.slice(16)}`
  );

  return {
    messageType,
    nonce,
    amount,
  };
};

const encodeCCTPMessage = (
  sourceDomain,
  sender,
  recipient,
  messageBody,
  version = 1
) => {
  const versionStr = version.toString(16).padStart(8, "0");
  const sourceDomainStr = sourceDomain.toString(16).padStart(8, "0");
  const senderStr = sender.replace("0x", "").toLowerCase().padStart(64, "0");
  const recipientStr = recipient
    .replace("0x", "")
    .toLowerCase()
    .padStart(64, "0");
  const messageBodyStr = messageBody.slice(2);
  return `0x${versionStr}${sourceDomainStr}${empty18Bytes}${senderStr}${recipientStr}${empty20Bytes}${messageBodyStr}`;
};

const encodeBurnMessageBody = (sender, recipient, amount, hookData) => {
  const senderEncoded = ethers.utils.defaultAbiCoder
    .encode(["address"], [sender])
    .slice(2);
  const recipientEncoded = ethers.utils.defaultAbiCoder
    .encode(["address"], [recipient])
    .slice(2);
  const amountEncoded = ethers.utils.defaultAbiCoder
    .encode(["uint256"], [amount])
    .slice(2);
  const encodedHookData = hookData.slice(2);
  return `0x00000001${empty16Bytes}${recipientEncoded}${amountEncoded}${senderEncoded}${empty16Bytes.repeat(
    3
  )}${encodedHookData}`;
};

const encodeBalanceCheckMessageBody = (nonce, balance) => {
  const encodedPayload = ethers.utils.defaultAbiCoder.encode(
    ["uint64", "uint256"],
    [nonce, balance]
  );

  // const version = 1010; // ORIGIN_MESSAGE_VERSION
  // const messageType = 3; // BALANCE_CHECK_MESSAGE
  return `0x000003f200000003${encodedPayload.slice(2)}`;
};

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
      await setStorageAt(
        crossChainMasterStrategy.address,
        `0x${REMOTE_STRATEGY_BALANCE_SLOT.toString(16)}`,
        usdcUnits("1000").toHexString()
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
      const { crossChainMasterStrategy, mockMessageTransmitter, strategist } =
        fixture;

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
      await replaceContractAt(
        await crossChainMasterStrategy.cctpMessageTransmitter(),
        mockMessageTransmitter
      );

      // Build check balance payload
      const balancePayload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("12345")
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
      const {
        crossChainMasterStrategy,
        mockMessageTransmitter,
        strategist,
        usdc,
        matt,
      } = fixture;

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
      await replaceContractAt(
        await crossChainMasterStrategy.cctpMessageTransmitter(),
        mockMessageTransmitter
      );

      // Build check balance payload
      const payload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("10000")
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
      const {
        crossChainMasterStrategy,
        mockMessageTransmitter,
        strategist,
        matt,
        usdc,
      } = fixture;

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
      await setStorageAt(
        crossChainMasterStrategy.address,
        `0x${REMOTE_STRATEGY_BALANCE_SLOT.toString(16)}`,
        usdcUnits("123456").toHexString()
      );

      // Simulate withdrawal call
      await crossChainMasterStrategy
        .connect(impersonatedVault)
        .withdraw(vaultAddr, usdc.address, usdcUnits("1000"));

      const lastNonce = (
        await crossChainMasterStrategy.lastTransferNonce()
      ).toNumber();

      // Replace transmitter to mock transmitter
      const actualTransmitter =
        await crossChainMasterStrategy.cctpMessageTransmitter();
      await replaceContractAt(actualTransmitter, mockMessageTransmitter);
      const replacedTransmitter = await ethers.getContractAt(
        "CCTPMessageTransmitterMock",
        actualTransmitter
      );
      await replacedTransmitter.setCCTPTokenMessenger(
        addresses.CCTPTokenMessengerV2
      );

      // Build check balance payload
      const balancePayload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("12345")
      );
      const burnPayload = encodeBurnMessageBody(
        crossChainMasterStrategy.address,
        crossChainMasterStrategy.address,
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
      const {
        crossChainMasterStrategy,
        mockMessageTransmitter,
        strategist,
        usdc,
      } = fixture;

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
      await setStorageAt(
        crossChainMasterStrategy.address,
        `0x${REMOTE_STRATEGY_BALANCE_SLOT.toString(16)}`,
        usdcUnits("1000").toHexString()
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
      await replaceContractAt(
        await crossChainMasterStrategy.cctpMessageTransmitter(),
        mockMessageTransmitter
      );

      // Build check balance payload
      const payload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("10000")
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
      const {
        crossChainMasterStrategy,
        mockMessageTransmitter,
        strategist,
        matt,
        usdc,
      } = fixture;

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
      await replaceContractAt(
        await crossChainMasterStrategy.cctpMessageTransmitter(),
        mockMessageTransmitter
      );

      // Build check balance payload
      const payload = encodeBalanceCheckMessageBody(
        lastNonce,
        usdcUnits("123244")
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
      const { crossChainMasterStrategy, mockMessageTransmitter, strategist } =
        fixture;

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
      await replaceContractAt(
        await crossChainMasterStrategy.cctpMessageTransmitter(),
        mockMessageTransmitter
      );

      const remoteStrategyBalanceBefore =
        await crossChainMasterStrategy.remoteStrategyBalance();

      // Build check balance payload
      const payload = encodeBalanceCheckMessageBody(
        lastNonce + 2,
        usdcUnits("123244")
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
  });

  // it.skip("Should handle attestation relay", async function () {
  //   const { crossChainMasterStrategy } = fixture;
  //   const attestation =
  //     "0xc0ee7623da7bad1b2607f12c21ce71c4314b4ade3d36a0e6e13753fbb0603daa2b10fcbbc4942ce75a2b8d5f5c11f4b6c5ee5f8dce4663d3ec834674d0a9991a1cdeb52adf17d5fb3222b1f94f0767175f06e69f9473e7f948a4b5c478814f11915ed64081cbe6e139fd277630b8807b56be7c355ccdda6c20acbf0324231fc8301b";
  //   const message =
  //     "0x0000000100000006000000000384bc6f6bfe10f6df4967b6ad287d897ff729f0c7e43f73a1e18ab156e96bfb0000000000000000000000008ebcca1066d15ad901927ab01c7c6d0b057bbd340000000000000000000000008ebcca1066d15ad901927ab01c7c6d0b057bbd3400000000000000000000000030f8a2fc7d7098061c94f042b2e7e732f95af40f00000000000003e8000003f20000000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

  //   await crossChainMasterStrategy.relay(message, attestation);
  // });
});
