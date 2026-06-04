const { expect } = require("chai");
const { ethers } = require("hardhat");

const ORIGIN_V3_MESSAGE_VERSION = 1020;

const MSG = {
  DEPOSIT: 1,
  DEPOSIT_ACK: 2,
  WITHDRAW_REQUEST: 3,
  WITHDRAW_REQUEST_ACK: 4,
  WITHDRAW_CLAIM: 5,
  WITHDRAW_CLAIM_ACK: 6,
  BALANCE_CHECK_REQUEST: 7,
  BALANCE_CHECK_RESPONSE: 8,
  SETTLE_BRIDGE_ACCOUNTING: 9,
  SETTLE_BRIDGE_ACCOUNTING_ACK: 10,
  BRIDGE_IN: 11,
  BRIDGE_OUT: 12,
};

describe("Unit: CrossChainV3Helper", function () {
  let harness;

  before(async () => {
    const Harness = await ethers.getContractFactory(
      "MockCrossChainV3HelperHarness"
    );
    harness = await Harness.deploy();
    await harness.deployed();
  });

  describe("constants & header layout", () => {
    it("exposes the canonical V3 message version", async () => {
      expect(await harness.version()).to.equal(ORIGIN_V3_MESSAGE_VERSION);
    });

    it("uses a 36-byte header (4 version + 4 type + 8 nonce + 20 sender)", async () => {
      expect(await harness.headerLength()).to.equal(36);
    });
  });

  const ZERO_SENDER = ethers.constants.AddressZero;
  const TEST_SENDER = "0x000000000000000000000000000000000000abcd";

  describe("wrap / unwrap envelope", () => {
    it("round-trips every yield-channel message type with a nonzero nonce", async () => {
      const cases = [
        { type: MSG.DEPOSIT, payload: "0x" },
        {
          type: MSG.DEPOSIT_ACK,
          payload: ethers.utils.defaultAbiCoder.encode(["uint256"], [12345]),
        },
        {
          type: MSG.WITHDRAW_REQUEST,
          payload: ethers.utils.defaultAbiCoder.encode(["uint256"], [777]),
        },
        {
          type: MSG.WITHDRAW_REQUEST_ACK,
          payload: ethers.utils.defaultAbiCoder.encode(["uint256"], [9000]),
        },
        { type: MSG.WITHDRAW_CLAIM, payload: "0x" },
        {
          type: MSG.WITHDRAW_CLAIM_ACK,
          payload: ethers.utils.defaultAbiCoder.encode(
            ["uint256", "bool"],
            [42, true]
          ),
        },
        {
          type: MSG.BALANCE_CHECK_REQUEST,
          payload: ethers.utils.defaultAbiCoder.encode(
            ["uint256"],
            [1700000000]
          ),
        },
        {
          type: MSG.BALANCE_CHECK_RESPONSE,
          payload: ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256"],
            [99, 1700000001]
          ),
        },
        { type: MSG.SETTLE_BRIDGE_ACCOUNTING, payload: "0x" },
        {
          type: MSG.SETTLE_BRIDGE_ACCOUNTING_ACK,
          payload: ethers.utils.defaultAbiCoder.encode(["uint256"], [555]),
        },
      ];

      const nonce = ethers.BigNumber.from("123456789012345678");
      for (const c of cases) {
        const wrapped = await harness.wrap(
          c.type,
          nonce,
          TEST_SENDER,
          c.payload
        );
        const [version, msgType, gotNonce, gotSender, gotPayload] =
          await harness.unwrap(wrapped);
        expect(version).to.equal(ORIGIN_V3_MESSAGE_VERSION);
        expect(msgType).to.equal(c.type);
        expect(gotNonce).to.equal(nonce);
        expect(gotSender.toLowerCase()).to.equal(TEST_SENDER);
        expect(gotPayload).to.equal(c.payload === "0x" ? "0x" : c.payload);

        // Direct getters match unwrap
        expect(await harness.getVersion(wrapped)).to.equal(
          ORIGIN_V3_MESSAGE_VERSION
        );
        expect(await harness.getMessageType(wrapped)).to.equal(c.type);
        expect(await harness.getNonce(wrapped)).to.equal(nonce);
        expect((await harness.getSender(wrapped)).toLowerCase()).to.equal(
          TEST_SENDER
        );
        expect(await harness.getPayload(wrapped)).to.equal(
          c.payload === "0x" ? "0x" : c.payload
        );
      }
    });

    it("round-trips bridge-channel messages with nonce 0", async () => {
      const bridgeId = ethers.utils.id("bridge-1");
      const payload = await harness.encodeBridgeUserPayload(
        bridgeId,
        ethers.utils.parseEther("100"),
        "0x000000000000000000000000000000000000beef",
        "0xdeadbeef",
        300000
      );

      const wrapped = await harness.wrap(
        MSG.BRIDGE_IN,
        0,
        ZERO_SENDER,
        payload
      );
      const [version, msgType, gotNonce, gotSender, gotPayload] =
        await harness.unwrap(wrapped);
      expect(version).to.equal(ORIGIN_V3_MESSAGE_VERSION);
      expect(msgType).to.equal(MSG.BRIDGE_IN);
      expect(gotNonce).to.equal(0);
      expect(gotSender).to.equal(ZERO_SENDER);
      expect(gotPayload).to.equal(payload);
    });

    it("rejects a message that is too short to contain a header", async () => {
      // 35-byte buffer can't carry the 36-byte header.
      const tooShort = "0x" + "ab".repeat(35);
      await expect(harness.unwrap(tooShort)).to.be.revertedWith(
        "V3: message too short"
      );
    });

    it("the wire layout is exactly the documented packing", async () => {
      const nonce = ethers.BigNumber.from("0x0807060504030201");
      const payload = "0xdeadbeef";
      const sender = "0x0000000000000000000000000000000000000abc";
      const wrapped = await harness.wrap(
        MSG.WITHDRAW_REQUEST,
        nonce,
        sender,
        payload
      );

      // Expected wire bytes:
      //   000003fc                -- version 1020 (0x3FC) as uint32 big-endian
      //   00000003                -- msgType 3 as uint32
      //   0807060504030201        -- nonce as uint64 big-endian
      //   00..0abc (20 bytes)     -- sender as packed address
      //   deadbeef                -- payload
      const expected =
        "0x000003fc" +
        "00000003" +
        "0807060504030201" +
        "0000000000000000000000000000000000000abc" +
        "deadbeef";
      expect(wrapped.toLowerCase()).to.equal(expected.toLowerCase());
    });
  });

  describe("payload encoders / decoders", () => {
    it("encodeNewBalancePayload round-trips", async () => {
      const v = ethers.utils.parseEther("123.456");
      const encoded = await harness.encodeNewBalancePayload(v);
      expect(await harness.decodeNewBalancePayload(encoded)).to.equal(v);
    });

    it("encodeAmountPayload round-trips", async () => {
      const v = ethers.utils.parseUnits("999.99", 6);
      const encoded = await harness.encodeAmountPayload(v);
      expect(await harness.decodeAmountPayload(encoded)).to.equal(v);
    });

    it("encodeWithdrawClaimAckPayload round-trips all branches", async () => {
      for (const [bal, ok, amt] of [
        [ethers.utils.parseEther("10"), true, ethers.utils.parseEther("3")],
        [ethers.utils.parseEther("0"), false, ethers.BigNumber.from(0)],
        [ethers.constants.MaxUint256, true, ethers.constants.MaxUint256],
      ]) {
        const encoded = await harness.encodeWithdrawClaimAckPayload(
          bal,
          ok,
          amt
        );
        const [gotBal, gotOk, gotAmt] =
          await harness.decodeWithdrawClaimAckPayload(encoded);
        expect(gotBal).to.equal(bal);
        expect(gotOk).to.equal(ok);
        expect(gotAmt).to.equal(amt);
      }
    });

    it("encodeBalanceCheckRequestPayload round-trips", async () => {
      const ts = 1718000000;
      const encoded = await harness.encodeBalanceCheckRequestPayload(ts);
      expect(await harness.decodeBalanceCheckRequestPayload(encoded)).to.equal(
        ts
      );
    });

    it("encodeBalanceCheckResponsePayload round-trips", async () => {
      const bal = ethers.utils.parseEther("42.42");
      const ts = 1718000001;
      const encoded = await harness.encodeBalanceCheckResponsePayload(bal, ts);
      const [gotBal, gotTs] = await harness.decodeBalanceCheckResponsePayload(
        encoded
      );
      expect(gotBal).to.equal(bal);
      expect(gotTs).to.equal(ts);
    });

    it("encodeBridgeUserPayload preserves empty callData", async () => {
      const bridgeId = ethers.utils.id("empty-call");
      const amount = ethers.utils.parseEther("1.5");
      const recipient = "0x000000000000000000000000000000000000abcd";
      const encoded = await harness.encodeBridgeUserPayload(
        bridgeId,
        amount,
        recipient,
        "0x",
        0
      );
      const [gotBridgeId, gotAmount, gotRecipient, gotCallData, gotGasLimit] =
        await harness.decodeBridgeUserPayload(encoded);
      expect(gotBridgeId).to.equal(bridgeId);
      expect(gotAmount).to.equal(amount);
      expect(gotRecipient).to.equal(ethers.utils.getAddress(recipient));
      expect(gotCallData).to.equal("0x");
      expect(gotGasLimit).to.equal(0);
    });

    it("encodeBridgeUserPayload preserves non-trivial callData", async () => {
      const bridgeId = ethers.utils.id("with-call");
      const amount = ethers.utils.parseEther("7");
      const recipient = "0x000000000000000000000000000000000000f00d";
      // 200-byte calldata
      const callData = "0x" + "ab".repeat(200);
      const callGasLimit = 250000;
      const encoded = await harness.encodeBridgeUserPayload(
        bridgeId,
        amount,
        recipient,
        callData,
        callGasLimit
      );
      const [gotBridgeId, gotAmount, gotRecipient, gotCallData, gotGasLimit] =
        await harness.decodeBridgeUserPayload(encoded);
      expect(gotBridgeId).to.equal(bridgeId);
      expect(gotAmount).to.equal(amount);
      expect(gotRecipient).to.equal(ethers.utils.getAddress(recipient));
      expect(gotCallData).to.equal(callData);
      expect(gotGasLimit).to.equal(callGasLimit);
    });
  });

  describe("extractUint64", () => {
    it("reads the nonce slot at offset 8 of an envelope", async () => {
      const nonce = ethers.BigNumber.from("0xfedcba9876543210");
      const wrapped = await harness.wrap(MSG.DEPOSIT, nonce, ZERO_SENDER, "0x");
      expect(await harness.extractUint64(wrapped, 8)).to.equal(nonce);
    });

    it("reverts when reading beyond the buffer", async () => {
      const wrapped = await harness.wrap(MSG.DEPOSIT, 1, ZERO_SENDER, "0x");
      // header is exactly 36 bytes (no payload here); reading 8 bytes at offset 36 overflows
      await expect(harness.extractUint64(wrapped, 36)).to.be.revertedWith(
        "Slice end exceeds data length"
      );
    });

    it("handles a uint64 at offset 0 in a standalone buffer", async () => {
      const u64 = ethers.BigNumber.from("0x0102030405060708");
      const data = ethers.utils.solidityPack(["uint64"], [u64]);
      expect(await harness.extractUint64(data, 0)).to.equal(u64);
    });
  });
});
