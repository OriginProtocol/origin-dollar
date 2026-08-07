const { expect } = require("chai");
const { ethers } = require("hardhat");

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

  describe("packPayload / unpackPayload (strategy envelope)", () => {
    it("round-trips every yield-channel message type with a nonzero nonce", async () => {
      const cases = [
        { type: MSG.DEPOSIT, body: "0x" },
        {
          type: MSG.DEPOSIT_ACK,
          body: ethers.utils.defaultAbiCoder.encode(["uint256"], [12345]),
        },
        {
          type: MSG.WITHDRAW_REQUEST,
          body: ethers.utils.defaultAbiCoder.encode(["uint256"], [777]),
        },
        {
          type: MSG.WITHDRAW_REQUEST_ACK,
          body: ethers.utils.defaultAbiCoder.encode(["uint256"], [9000]),
        },
        { type: MSG.WITHDRAW_CLAIM, body: "0x" },
        {
          type: MSG.WITHDRAW_CLAIM_ACK,
          body: ethers.utils.defaultAbiCoder.encode(
            ["uint256", "bool", "uint256"],
            [42, true, 7]
          ),
        },
        {
          type: MSG.BALANCE_CHECK_REQUEST,
          body: ethers.utils.defaultAbiCoder.encode(["uint256"], [1700000000]),
        },
        {
          type: MSG.BALANCE_CHECK_RESPONSE,
          body: ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256"],
            [99, 1700000001]
          ),
        },
        { type: MSG.SETTLE_BRIDGE_ACCOUNTING, body: "0x" },
        {
          type: MSG.SETTLE_BRIDGE_ACCOUNTING_ACK,
          body: ethers.utils.defaultAbiCoder.encode(["uint256"], [555]),
        },
      ];

      const nonce = ethers.BigNumber.from("123456789012345678");
      for (const c of cases) {
        const packed = await harness.packPayload(c.type, nonce, c.body);
        const [msgType, gotNonce, gotBody] = await harness.unpackPayload(
          packed
        );
        expect(msgType).to.equal(c.type);
        expect(gotNonce).to.equal(nonce);
        expect(gotBody).to.equal(c.body === "0x" ? "0x" : c.body);
      }
    });

    it("round-trips bridge-channel messages with nonce 0", async () => {
      const bridgeId = ethers.utils.id("bridge-1");
      const body = await harness.encodeBridgeUserPayload(
        bridgeId,
        ethers.utils.parseEther("100"),
        "0x000000000000000000000000000000000000beef",
        "0xdeadbeef",
        300000
      );

      const packed = await harness.packPayload(MSG.BRIDGE_IN, 0, body);
      const [msgType, gotNonce, gotBody] = await harness.unpackPayload(packed);
      expect(msgType).to.equal(MSG.BRIDGE_IN);
      expect(gotNonce).to.equal(0);
      expect(gotBody).to.equal(body);
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
});
