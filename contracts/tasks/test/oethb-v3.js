const { expect } = require("chai");
const { BigNumber, ethers } = require("ethers");

const {
  MAX_TOPUP_WEI,
  MIN_POOL_SENDS,
  MSG,
  REQUEST_ID_EMPTY,
  TARGET_POOL_SENDS,
  claimReadiness,
  claimTopUp,
  encodePayload,
  reportDecision,
  reportTopUp,
  retryableIdle,
} = require("../lib/oethbV3");

const bn = (v) => BigNumber.from(v);
const eth = (v) => ethers.utils.parseEther(v);
const FEE = eth("0.000225");

describe("OETHb V3 actions", () => {
  describe("reportDecision", () => {
    const base = {
      masterInFlight: false,
      masterNonce: bn(3),
      remoteNonce: bn(3),
      remoteBalance: eth("100"),
      masterRemoteBalance: eth("99"),
    };

    it("sends when Master is idle and nonces agree", () => {
      expect(reportDecision(base)).to.deep.equal({ action: "send" });
    });

    it("skips while Master has an operation in flight", () => {
      // A mismatched nonce is expected mid-operation; it must not read as an error.
      const d = reportDecision({
        ...base,
        masterInFlight: true,
        masterNonce: bn(4),
      });
      expect(d.action).to.equal("skip");
    });

    it("errors on a nonce mismatch with Master idle", () => {
      const d = reportDecision({ ...base, remoteNonce: bn(2) });
      expect(d.action).to.equal("error");
    });

    it("skips when both balances are zero", () => {
      const d = reportDecision({
        ...base,
        remoteBalance: bn(0),
        masterRemoteBalance: bn(0),
      });
      expect(d.action).to.equal("skip");
    });

    it("sends when only one side is zero", () => {
      const d = reportDecision({ ...base, masterRemoteBalance: bn(0) });
      expect(d.action).to.equal("send");
    });
  });

  describe("reportTopUp", () => {
    it("tops up an empty pool to the target", () => {
      expect(reportTopUp(bn(0), FEE)).to.deep.equal(FEE.mul(TARGET_POOL_SENDS));
    });

    it("tops up a pool just below the floor to the target", () => {
      const pool = FEE.mul(MIN_POOL_SENDS).sub(1);
      expect(reportTopUp(pool, FEE)).to.deep.equal(
        FEE.mul(TARGET_POOL_SENDS).sub(pool)
      );
    });

    it("sends nothing at or above the floor", () => {
      expect(reportTopUp(FEE.mul(MIN_POOL_SENDS), FEE).isZero()).to.equal(true);
    });

    it("caps the top-up", () => {
      expect(reportTopUp(bn(0), eth("0.01"))).to.deep.equal(MAX_TOPUP_WEI);
    });
  });

  describe("claimTopUp", () => {
    it("covers twice the fee when the pool is short", () => {
      expect(claimTopUp(bn(100), bn(300))).to.deep.equal(bn(500));
    });

    it("sends nothing when the pool covers the fee", () => {
      expect(claimTopUp(bn(300), bn(300)).isZero()).to.equal(true);
    });
  });

  describe("claimReadiness", () => {
    const NOW = 1800000000;
    const fakes = ({ timestamp = NOW - 1000, delay = 600, claim } = {}) => ({
      readRequest: async () => ({ timestamp }),
      readDelay: async () => bn(delay),
      simulateClaim: claim || (async () => bn(1)),
    });

    it("is ready when the claim already landed on Remote", async () => {
      const r = await claimReadiness({
        requestId: REQUEST_ID_EMPTY,
        requestAmount: eth("1"),
        now: NOW,
        ...fakes({
          claim: async () => {
            throw new Error("must not simulate");
          },
        }),
      });
      expect(r.ready).to.equal(true);
    });

    it("throws when Remote has neither a request nor a claimed amount", async () => {
      let err;
      try {
        await claimReadiness({
          requestId: REQUEST_ID_EMPTY,
          requestAmount: bn(0),
          now: NOW,
          ...fakes(),
        });
      } catch (e) {
        err = e;
      }
      expect(err).to.be.instanceOf(Error);
    });

    it("waits until the claim delay has elapsed", async () => {
      const r = await claimReadiness({
        requestId: bn(7),
        requestAmount: eth("1"),
        now: NOW,
        ...fakes({ timestamp: NOW - 100 }),
      });
      expect(r.ready).to.equal(false);
      expect(r.reason).to.contain("500s");
    });

    it("waits when the claim simulation reverts", async () => {
      const r = await claimReadiness({
        requestId: bn(7),
        requestAmount: eth("1"),
        now: NOW,
        ...fakes({
          claim: async () => {
            throw Object.assign(new Error("x"), {
              reason: "Queue pending liquidity",
            });
          },
        }),
      });
      expect(r.ready).to.equal(false);
      expect(r.reason).to.contain("Queue pending liquidity");
    });

    it("is ready when the delay elapsed and the claim simulates", async () => {
      const r = await claimReadiness({
        requestId: bn(7),
        requestAmount: eth("1"),
        now: NOW,
        ...fakes(),
      });
      expect(r.ready).to.equal(true);
    });
  });

  describe("retryableIdle", () => {
    it("reserves claimed-but-unshipped WETH for leg 2", () => {
      const r = retryableIdle({
        wethBalance: eth("5"),
        oethBalance: bn(0),
        requestId: REQUEST_ID_EMPTY,
        requestAmount: eth("3"),
      });
      expect(r.idleWeth).to.deep.equal(eth("2"));
    });

    it("reserves nothing while the request is still queued", () => {
      const r = retryableIdle({
        wethBalance: eth("5"),
        oethBalance: eth("1"),
        requestId: bn(7),
        requestAmount: eth("3"),
      });
      expect(r.idleWeth).to.deep.equal(eth("5"));
      expect(r.idleOeth).to.deep.equal(eth("1"));
    });
  });

  describe("encodePayload", () => {
    it("encodes (uint32 msgType, uint64 nonce, bytes body)", () => {
      const p = encodePayload(MSG.WITHDRAW_CLAIM, 9);
      const [t, n, b] = ethers.utils.defaultAbiCoder.decode(
        ["uint32", "uint64", "bytes"],
        p
      );
      expect(t).to.equal(5);
      expect(n.toNumber()).to.equal(9);
      expect(b).to.equal("0x");
    });
  });
});
