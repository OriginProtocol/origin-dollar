const { expect } = require("chai");

const {
  decodeOriginMessage,
  nonceIsReplayKey,
} = require("../../../tasks/crossChain");
const {
  encodeCCTPMessage,
  encodeDepositMessageBody,
  encodeWithdrawMessageBody,
  encodeBurnMessageBody,
  encodeBalanceCheckMessageBody,
} = require("./_crosschain-helpers");

// Unit test for the JS message decoder used by the CCTP relay actions. The
// fixtures are built with the same encoders the on-chain contracts use, so the
// decoder is exercised against production-shaped messages.
describe("Unit: decodeOriginMessage (CCTP relay)", () => {
  const sourceDomain = 6; // Base
  const sender = "0x0000000000000000000000000000000000000001";
  const recipient = "0x0000000000000000000000000000000000000002";
  const usdc = "0x0000000000000000000000000000000000000003";
  const amount = "1000000"; // 1 USDC

  const balanceCheck = (nonce, transferConfirmation) =>
    encodeCCTPMessage(
      sourceDomain,
      sender,
      recipient,
      encodeBalanceCheckMessageBody(
        nonce,
        amount,
        transferConfirmation,
        1700000000
      )
    );

  it("decodes a deposit (burn message with hook data)", () => {
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

    const decoded = decodeOriginMessage(message);
    expect(decoded.messageType).to.eq(1);
    expect(decoded.nonce.toNumber()).to.eq(nonce);
    expect(decoded.transferConfirmation).to.eq(null);
  });

  it("decodes a withdraw (plain message)", () => {
    const nonce = 42;
    const body = encodeWithdrawMessageBody(nonce, amount);
    const message = encodeCCTPMessage(sourceDomain, sender, recipient, body);

    const decoded = decodeOriginMessage(message);
    expect(decoded.messageType).to.eq(2);
    expect(decoded.nonce.toNumber()).to.eq(nonce);
    expect(decoded.transferConfirmation).to.eq(null);
  });

  it("decodes a transfer-confirmation balance check", () => {
    const nonce = 123;
    const decoded = decodeOriginMessage(balanceCheck(nonce, true));

    expect(decoded.messageType).to.eq(3);
    expect(decoded.nonce.toNumber()).to.eq(nonce);
    expect(decoded.transferConfirmation).to.eq(true);
  });

  // A periodic balance update carries the already-settled lastTransferNonce, so
  // the relay must not treat isNonceProcessed(nonce) as proof it was relayed.
  it("decodes a periodic balance check", () => {
    const nonce = 123;
    const decoded = decodeOriginMessage(balanceCheck(nonce, false));

    expect(decoded.messageType).to.eq(3);
    expect(decoded.nonce.toNumber()).to.eq(nonce);
    expect(decoded.transferConfirmation).to.eq(false);
  });

  it("returns null for a non-Origin message body", () => {
    // Version != 1010 and too short to be a burn message with Origin hook data
    const body = "0xdeadbeef00000000";
    const message = encodeCCTPMessage(sourceDomain, sender, recipient, body);

    expect(decodeOriginMessage(message)).to.eq(null);
  });

  it("returns null for empty or missing input", () => {
    expect(decodeOriginMessage(undefined)).to.eq(null);
    expect(decodeOriginMessage("0x")).to.eq(null);
  });

  // isNonceProcessed on the destination only proves a message was already
  // relayed when its nonce is single-use. Periodic balance updates reuse the
  // settled lastTransferNonce, so gating them on it skips them forever.
  describe("nonceIsReplayKey", () => {
    it("is true for deposits and withdraws", () => {
      const deposit = encodeCCTPMessage(
        sourceDomain,
        sender,
        recipient,
        encodeBurnMessageBody(
          sender,
          recipient,
          usdc,
          amount,
          encodeDepositMessageBody(7, amount)
        )
      );
      const withdraw = encodeCCTPMessage(
        sourceDomain,
        sender,
        recipient,
        encodeWithdrawMessageBody(42, amount)
      );

      expect(nonceIsReplayKey(decodeOriginMessage(deposit))).to.eq(true);
      expect(nonceIsReplayKey(decodeOriginMessage(withdraw))).to.eq(true);
    });

    it("is true for a transfer-confirmation balance check", () => {
      expect(
        nonceIsReplayKey(decodeOriginMessage(balanceCheck(123, true)))
      ).to.eq(true);
    });

    it("is false for a periodic balance check", () => {
      expect(
        nonceIsReplayKey(decodeOriginMessage(balanceCheck(123, false)))
      ).to.eq(false);
    });
  });
});
