const { ethers } = require("hardhat");

/**
 * Strategy-level message-type enum (mirror of `CrossChainV3Helper.sol`'s
 * `uint32` constants). Strategies wrap each cross-chain operation's body in
 * `abi.encode(msgType, nonce, body)` before handing it to the adapter as the
 * `payload` argument.
 */
const MSG = {
  DEPOSIT: 1,
  DEPOSIT_ACK: 2,
  WITHDRAW_REQUEST: 3,
  WITHDRAW_REQUEST_ACK: 4,
  WITHDRAW_CLAIM: 5,
  WITHDRAW_CLAIM_ACK: 6,
  BALANCE_REPORT: 7,
};

/**
 * Strategy-level envelope: `abi.encode(uint32 msgType, uint64 nonce, bytes body)`.
 * This is what `MockBridgeAdapter` and `_validateInbound` consume as the
 * application payload. The adapter wraps an outer 52-byte (sender +
 * intendedAmount) header around it before sending across the wire.
 */
const encodePackedEnvelope = (msgType, nonce, payloadHex) => {
  return ethers.utils.defaultAbiCoder.encode(
    ["uint32", "uint64", "bytes"],
    [msgType, nonce, payloadHex]
  );
};

/**
 * Single-`uint256` body. Used by DEPOSIT_ACK and WITHDRAW_REQUEST_ACK whose
 * body is just `newBalance`.
 */
const encodeNewBalancePayload = (newBalance) =>
  ethers.utils.defaultAbiCoder.encode(["uint256"], [newBalance]);

/**
 * Adapter-level envelope (the OUTER 52-byte header + opaque payload). The
 * MockBridgeAdapter / real adapters build this in Solidity; tests that
 * synthesize raw wire messages build it manually with `solidityPack`.
 */
const wrapAppEnvelope = (envelopeSender, intendedAmount, payload) => {
  return ethers.utils.solidityPack(
    ["address", "uint256", "bytes"],
    [envelopeSender, intendedAmount, payload]
  );
};

module.exports = {
  MSG,
  encodePackedEnvelope,
  encodeNewBalancePayload,
  wrapAppEnvelope,
};
