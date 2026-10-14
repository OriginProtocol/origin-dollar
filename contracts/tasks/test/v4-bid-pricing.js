const { expect } = require("chai");
const { BigNumber } = require("ethers");

const {
  bidToTickLower,
  kyberRate,
  parseQuoteSizes,
  targetBidPrice,
  tickLowerToBid,
} = require("../lib/v4BidPricing");
const { pricingAlert } = require("../actions/ousdV4Rebalance");

// The reported bid is what the Safe sets its ranges from: a tick too low buys
// token1 above what redeeming it returns, a tick too high loses every trade.
// Pin the formula and the rounding at tick boundaries.
describe("Unit: v4 bid pricing", () => {
  describe("targetBidPrice", () => {
    it("beats the market net of the OUSD -> USDC exit", () => {
      // Seller gets 0.9995 USDC/USDe elsewhere; OUSD exits at 0.99987.
      const { bid, capped } = targetBidPrice({
        usdcPerToken1: 0.9995,
        usdcPerOusd: 0.99987,
        offsetBps: 0.2,
        redeemCostBps: 1,
      });
      expect(capped).to.equal(false);
      // What the seller nets through us beats the market by the offset.
      expect(bid * 0.99987).to.be.closeTo(0.9995 * 1.00002, 1e-12);
    });

    it("caps the bid at par minus the redeem cost when the market is tight", () => {
      const { bid, capped } = targetBidPrice({
        usdcPerToken1: 1.00048,
        usdcPerOusd: 0.99987,
        offsetBps: 0.2,
        redeemCostBps: 1,
      });
      expect(capped).to.equal(true);
      expect(bid).to.equal(0.9999);
    });

    it("rejects non-positive rates", () => {
      expect(() =>
        targetBidPrice({
          usdcPerToken1: 0,
          usdcPerOusd: 1,
          offsetBps: 0,
          redeemCostBps: 0,
        })
      ).to.throw("Invalid reference rates");
    });
  });

  describe("bidToTickLower", () => {
    it("is the lowest tick whose top bid does not exceed the target", () => {
      for (const bid of [0.99997, 0.9995, 0.998, 0.95]) {
        const tick = bidToTickLower(bid, 1);
        expect(tickLowerToBid(tick)).to.be.at.most(bid);
        expect(tickLowerToBid(tick - 1)).to.be.above(bid);
      }
    });

    it("treats a bid a hair under a tick as on it", () => {
      // 1.0001^-1 = 0.99990001, 0.0001 bp above a 1 bp redeem-cost cap.
      expect(bidToTickLower(0.9999, 1)).to.equal(1);
    });

    it("lands exactly on a tick whose bid is the target", () => {
      expect(bidToTickLower(Math.pow(1.0001, -3), 1)).to.equal(3);
      expect(bidToTickLower(1, 1)).to.equal(0);
    });

    it("rounds away from par to the tick spacing", () => {
      expect(bidToTickLower(0.9997, 10)).to.equal(10);
    });

    it("goes negative above par, which the module's floor rejects", () => {
      expect(bidToTickLower(1.0002, 1)).to.be.below(0);
    });
  });

  describe("pricingAlert", () => {
    it("alerts only past the tick threshold, in either direction", () => {
      expect(pricingAlert({ current: 3, target: 5, alertTickMove: 3 })).to.be
        .false;
      expect(pricingAlert({ current: 3, target: 6, alertTickMove: 3 })).to.be
        .true;
      expect(pricingAlert({ current: 3, target: 0, alertTickMove: 3 })).to.be
        .true;
    });
  });

  describe("parseQuoteSizes", () => {
    it("applies a single size to every position", () => {
      expect(parseQuoteSizes("100000", 3)).to.deep.equal([
        100000, 100000, 100000,
      ]);
    });

    it("takes one size per position", () => {
      expect(parseQuoteSizes("20000, 100000", 2)).to.deep.equal([
        20000, 100000,
      ]);
    });

    it("rejects a count mismatch and bad values", () => {
      expect(() => parseQuoteSizes("1,2", 3)).to.throw("2 values for 3");
      expect(() => parseQuoteSizes("abc", 1)).to.throw("Invalid --quote-size");
      expect(() => parseQuoteSizes("0", 1)).to.throw("Invalid --quote-size");
    });
  });

  describe("kyberRate", () => {
    const fakeFetch = (body, ok = true, status = 200) => {
      const calls = [];
      const impl = async (url, init) => {
        calls.push({ url: new URL(url), init });
        return { ok, status, json: async () => body };
      };
      return { impl, calls };
    };

    it("returns tokenOut per tokenIn and excludes our pools", async () => {
      const { impl, calls } = fakeFetch({
        data: { routeSummary: { amountOut: "99950000000" } },
      });
      const rate = await kyberRate({
        tokenIn: "0xIn",
        tokenOut: "0xOut",
        amountIn: BigNumber.from("100000000000000000000000"),
        decimalsIn: 18,
        decimalsOut: 6,
        excludedPools: ["0xpool1", "0xpool2"],
        fetchImpl: impl,
      });
      expect(rate).to.be.closeTo(0.9995, 1e-12);
      const params = calls[0].url.searchParams;
      expect(params.get("tokenIn")).to.equal("0xIn");
      expect(params.get("amountIn")).to.equal("100000000000000000000000");
      expect(params.get("excludedPools")).to.equal("0xpool1,0xpool2");
    });

    it("throws on an HTTP error or a missing route", async () => {
      const args = {
        tokenIn: "0xIn",
        tokenOut: "0xOut",
        amountIn: BigNumber.from(1),
        decimalsIn: 18,
        decimalsOut: 6,
      };
      let err;
      try {
        await kyberRate({ ...args, fetchImpl: fakeFetch({}, false, 500).impl });
      } catch (e) {
        err = e;
      }
      expect(err.message).to.contain("HTTP 500");

      err = undefined;
      try {
        await kyberRate({ ...args, fetchImpl: fakeFetch({ data: {} }).impl });
      } catch (e) {
        err = e;
      }
      expect(err.message).to.contain("no route");
    });
  });
});
