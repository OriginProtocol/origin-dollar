const ethers = require("ethers");

const emptyByte = "0000";
const empty2Bytes = emptyByte.repeat(2);
const empty4Bytes = emptyByte.repeat(4);
const empty16Bytes = empty4Bytes.repeat(4);
const empty18Bytes = `${empty2Bytes}${empty16Bytes}`;
const empty20Bytes = empty4Bytes.repeat(5);

const encodeOriginMessage = (messageType, values, types) => {
  const payload = ethers.utils.defaultAbiCoder.encode(types, values);
  return `0x000003f2${messageType.toString(16).padStart(8, "0")}${payload.slice(
    2
  )}`;
};

const encodeDepositMessageBody = (nonce, amount) =>
  encodeOriginMessage(1, [nonce, amount], ["uint64", "uint256"]);

const encodeWithdrawMessageBody = (nonce, amount) =>
  encodeOriginMessage(2, [nonce, amount], ["uint64", "uint256"]);

const encodeBalanceCheckMessageBody = (
  nonce,
  balance,
  transferConfirmation,
  timestamp
) =>
  encodeOriginMessage(
    3,
    [nonce, balance, transferConfirmation, timestamp],
    ["uint64", "uint256", "bool", "uint256"]
  );

const encodeCCTPMessage = (
  sourceDomain,
  sender,
  recipient,
  messageBody,
  version = 1
) => {
  const versionHex = version.toString(16).padStart(8, "0");
  const sourceDomainHex = sourceDomain.toString(16).padStart(8, "0");
  const senderHex = sender.slice(2).toLowerCase().padStart(64, "0");
  const recipientHex = recipient.slice(2).toLowerCase().padStart(64, "0");

  return `0x${versionHex}${sourceDomainHex}${empty18Bytes}${senderHex}${recipientHex}${empty20Bytes}${messageBody.slice(
    2
  )}`;
};

const encodeBurnMessageBody = (
  sender,
  recipient,
  burnToken,
  amount,
  hookData
) => {
  const encodedHeader = ethers.utils.defaultAbiCoder
    .encode(
      ["address", "address", "uint256", "address"],
      [burnToken, recipient, amount, sender]
    )
    .slice(2);

  return `0x00000001${encodedHeader}${empty16Bytes.repeat(3)}${hookData.slice(
    2
  )}`;
};

module.exports = {
  encodeBalanceCheckMessageBody,
  encodeBurnMessageBody,
  encodeCCTPMessage,
  encodeDepositMessageBody,
  encodeWithdrawMessageBody,
};
