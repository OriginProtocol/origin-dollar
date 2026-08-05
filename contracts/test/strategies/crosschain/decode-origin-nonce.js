const { expect } = require("chai");

const { decodeOriginNonce } = require("../../../tasks/crossChain");
const {
  encodeCCTPMessage,
  encodeDepositMessageBody,
  encodeWithdrawMessageBody,
  encodeBurnMessageBody,
  encodeBalanceCheckMessageBody,
} = require("./_crosschain-helpers");

// Unit test for the JS nonce decoder used by the CCTP relay actions. The
// fixtures are built with the same encoders the on-chain contracts use, so the
// decoder is exercised against production-shaped messages.
describe("Unit: decodeOriginNonce (CCTP relay)", () => {
  const sourceDomain = 6; // Base
  const sender = "0x0000000000000000000000000000000000000001";
  const recipient = "0x0000000000000000000000000000000000000002";
  const usdc = "0x0000000000000000000000000000000000000003";
  const amount = "1000000"; // 1 USDC

  it("decodes nonce from a deposit (burn message with hook data)", () => {
    const nonce = 7;
    const hookData = encodeDepositMessageBody(nonce, amount);
    const burnBody = encodeBurnMessageBody(
      sender,
      recipient,
      usdc,
      amount,
      hookData
    );
    const message = encodeCCTPMessage(
      sourceDomain,
      sender,
      recipient,
      burnBody
    );

    expect(decodeOriginNonce(message).toNumber()).to.eq(nonce);
  });

  it("decodes nonce from a withdraw (plain message)", () => {
    const nonce = 42;
    const body = encodeWithdrawMessageBody(nonce, amount);
    const message = encodeCCTPMessage(sourceDomain, sender, recipient, body);

    expect(decodeOriginNonce(message).toNumber()).to.eq(nonce);
  });

  it("decodes nonce from a balance check (plain message)", () => {
    const nonce = 123;
    const body = encodeBalanceCheckMessageBody(nonce, amount, true, 1700000000);
    const message = encodeCCTPMessage(sourceDomain, sender, recipient, body);

    expect(decodeOriginNonce(message).toNumber()).to.eq(nonce);
  });

  it("returns null for a non-Origin message body", () => {
    // Version != 1010 and too short to be a burn message with Origin hook data
    const body = "0xdeadbeef00000000";
    const message = encodeCCTPMessage(sourceDomain, sender, recipient, body);

    expect(decodeOriginNonce(message)).to.eq(null);
  });

  it("returns null for empty or missing input", () => {
    expect(decodeOriginNonce(undefined)).to.eq(null);
    expect(decodeOriginNonce("0x")).to.eq(null);
  });
});
