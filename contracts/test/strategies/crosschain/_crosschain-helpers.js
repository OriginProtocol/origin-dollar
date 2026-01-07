const { expect } = require("chai");

const addresses = require("../../../utils/addresses");
const { replaceContractAt } = require("../../../utils/hardhat");
const { setStorageAt } = require("@nomicfoundation/hardhat-network-helpers");

const DEPOSIT_FOR_BURN_EVENT_TOPIC =
  "0x0c8c1cbdc5190613ebd485511d4e2812cfa45eecb79d845893331fedad5130a5";
const MESSAGE_SENT_EVENT_TOPIC =
  "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036";

const emptyByte = "0000";
const empty2Bytes = emptyByte.repeat(2);
const empty4Bytes = emptyByte.repeat(4);
const empty16Bytes = empty4Bytes.repeat(4);
const empty18Bytes = `${empty2Bytes}${empty16Bytes}`;
const empty20Bytes = empty4Bytes.repeat(5);

const REMOTE_STRATEGY_BALANCE_SLOT = 207;

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
  const endIndex = evData.endsWith("00000000")
    ? evData.length - 8
    : evData.length;
  const payload = `0x${evData.slice(296, endIndex)}`;

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

const encodeDepositMessageBody = (nonce, amount) => {
  const encodedPayload = ethers.utils.defaultAbiCoder.encode(
    ["uint64", "uint256"],
    [nonce, amount]
  );
  return `0x000003f200000001${encodedPayload.slice(2)}`;
};

const encodeWithdrawMessageBody = (nonce, amount) => {
  const encodedPayload = ethers.utils.defaultAbiCoder.encode(
    ["uint64", "uint256"],
    [nonce, amount]
  );
  return `0x000003f200000002${encodedPayload.slice(2)}`;
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
const decodeBurnMessageBody = (message) => {
  message = message.slice(2); // Ignore 0x prefix

  const version = ethers.BigNumber.from(`0x${message.slice(0, 8)}`);
  expect(version).to.eq(1);
  const [burnToken, recipient, amount, sender] =
    ethers.utils.defaultAbiCoder.decode(
      ["address", "address", "uint256", "address"],
      `0x${message.slice(8, 264)}`
    );

  const hookData = `0x${message.slice(456)}`; // Ignore 0x prefix and following 96 bytes
  return { version, burnToken, recipient, amount, sender, hookData };
};

const encodeBalanceCheckMessageBody = (nonce, balance, transferConfirmation) => {
  const encodedPayload = ethers.utils.defaultAbiCoder.encode(
    ["uint64", "uint256", "bool"],
    [nonce, balance, transferConfirmation]
  );

  // const version = 1010; // ORIGIN_MESSAGE_VERSION
  // const messageType = 3; // BALANCE_CHECK_MESSAGE
  return `0x000003f200000003${encodedPayload.slice(2)}`;
};

const decodeBalanceCheckMessageBody = (message) => {
  message = message.slice(2); // Ignore 0x prefix
  const version = ethers.BigNumber.from(`0x${message.slice(0, 8)}`);
  const messageType = ethers.BigNumber.from(`0x${message.slice(8, 16)}`);
  expect(version).to.eq(1010);
  expect(messageType).to.eq(3);
  const [nonce, balance] = ethers.utils.defaultAbiCoder.decode(
    ["uint64", "uint256"],
    `0x${message.slice(16)}`
  );
  return { version, messageType, nonce, balance };
};

const replaceMessageTransmitter = async () => {
  const mockMessageTransmitter = await ethers.getContract(
    "CCTPMessageTransmitterMock2"
  );
  await replaceContractAt(
    addresses.CCTPMessageTransmitterV2,
    mockMessageTransmitter
  );
  const replacedTransmitter = await ethers.getContractAt(
    "CCTPMessageTransmitterMock2",
    addresses.CCTPMessageTransmitterV2
  );
  await replacedTransmitter.setCCTPTokenMessenger(
    addresses.CCTPTokenMessengerV2
  );

  return replacedTransmitter;
};

const setRemoteStrategyBalance = async (strategy, balance) => {
  await setStorageAt(
    strategy.address,
    `0x${REMOTE_STRATEGY_BALANCE_SLOT.toString(16)}`,
    balance.toHexString()
  );
};

module.exports = {
  DEPOSIT_FOR_BURN_EVENT_TOPIC,
  MESSAGE_SENT_EVENT_TOPIC,
  emptyByte,
  empty2Bytes,
  empty4Bytes,
  empty16Bytes,
  empty18Bytes,
  empty20Bytes,
  REMOTE_STRATEGY_BALANCE_SLOT,
  setRemoteStrategyBalance,
  decodeDepositForBurnEvent,
  decodeMessageSentEvent,
  decodeDepositOrWithdrawMessage,
  encodeCCTPMessage,
  encodeDepositMessageBody,
  encodeWithdrawMessageBody,
  encodeBurnMessageBody,
  decodeBurnMessageBody,
  encodeBalanceCheckMessageBody,
  decodeBalanceCheckMessageBody,
  replaceMessageTransmitter,
};
