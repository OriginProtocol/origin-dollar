const { expect } = require("chai");

const {
  fundableToken0,
  ousdUsdeKey,
  planRebalance,
  poolIdOf,
  resetAmount,
  targetPrice,
  targetTickLower,
} = require("../actions/ousdUsdeV4Rebalance");
const {
  liquidityForToken0,
  positionToken0,
  positionToken1,
  unpackTicks,
} = require("../lib/v4Liquidity");
const { getSqrtPriceAtTick } = require("../lib/v4TickMath");

const E18 = BigInt(10) ** BigInt(18);
const units = (n) => BigInt(n) * E18;

// The module holds no pricing: Talos picks the tick, the size and when to
// move. Pin each of them.
describe("Unit: ousdUsdeV4Rebalance", () => {
  it("targets the live OUSD/USDe pool", () => {
    expect(poolIdOf(ousdUsdeKey())).to.equal(
      "0xa6075a4d90b1de293e0347fa4319584d2b57c0c6faf576a4bd4108450ec45622"
    );
  });

  describe("targetPrice", () => {
    it("caps at par less capBps when the market bids above it", () => {
      // Calm market: USDe 0.99978 USDC, OUSD exits at 0.99981 -> 0.99997 OUSD.
      const t = targetPrice({
        bidUsdc: 0.99978,
        exitRate: 0.99981,
        offsetBps: 1,
        capBps: 4,
      });
      expect(t.capped).to.equal(true);
      expect(t.price).to.equal(1.0001 ** -4);
    });

    it("follows the market below the cap", () => {
      // Depeg: USDe at 0.997 USDC.
      const t = targetPrice({
        bidUsdc: 0.997,
        exitRate: 0.9998,
        offsetBps: 1,
        capBps: 4,
      });
      expect(t.capped).to.equal(false);
      expect(t.price).to.be.closeTo((0.997 * 1.0001) / 0.9998, 1e-12);
    });

    it("rejects bad inputs", () => {
      expect(() =>
        targetPrice({ bidUsdc: 0, exitRate: 1, offsetBps: 1, capBps: 4 })
      ).to.throw("Invalid market rates");
      expect(() =>
        targetPrice({ bidUsdc: 1, exitRate: 1, offsetBps: 1, capBps: -1 })
      ).to.throw("Invalid cap");
    });
  });

  describe("targetTickLower", () => {
    it("puts the 4 bp cap on tick 4", () => {
      const { price } = targetPrice({
        bidUsdc: 1,
        exitRate: 1,
        offsetBps: 1,
        capBps: 4,
      });
      expect(targetTickLower(price)).to.equal(4);
    });

    it("rounds away from the target: never pays more than the price", () => {
      // 3.8 ticks below par -> tick 4, whose price 0.99960 <= 0.99962.
      expect(targetTickLower(0.99962)).to.equal(4);
      expect(1.0001 ** -targetTickLower(0.99962)).to.be.at.most(0.99962);
    });

    it("follows a depeg down", () => {
      expect(targetTickLower(0.997)).to.equal(31);
    });

    it("refuses a range priced above par", () => {
      expect(() => targetTickLower(1.0002)).to.throw("above par");
    });
  });

  describe("planRebalance", () => {
    const base = {
      tokenId: 457273n,
      liquidity: units(1),
      token1: 0n,
      minToken1: units(500),
      currentLower: 4,
      targetLower: 4,
      maxDrift: 1,
    };

    it("mints when there is no position", () => {
      expect(planRebalance({ ...base, tokenId: 0n }).why).to.equal("Mint");
      expect(planRebalance({ ...base, liquidity: 0n }).why).to.equal("Mint");
    });

    it("pulls a fill", () => {
      expect(planRebalance({ ...base, token1: units(500) })).to.deep.equal({
        send: true,
        why: "Filled",
      });
    });

    it("moves when the target drifts a tick, either way", () => {
      expect(planRebalance({ ...base, targetLower: 30 }).why).to.equal(
        "Market down"
      );
      expect(
        planRebalance({ ...base, currentLower: 30, targetLower: 4 }).why
      ).to.equal("Market up");
    });

    it("stays put otherwise", () => {
      expect(planRebalance({ ...base, token1: units(499) })).to.deep.equal({
        send: false,
        why: "In place",
      });
    });
  });

  describe("fundableToken0", () => {
    const base = {
      target: units(50000),
      safeToken0: units(100000),
      positionToken0: 0n,
      resetAmount0: 0n,
      maxPerCall: units(100000),
      remainingToday: units(200000),
    };

    it("gives the target when everything allows it", () => {
      expect(fundableToken0(base)).to.equal(units(50000));
    });

    it("caps at what the Safe holds once the position is burned", () => {
      expect(
        fundableToken0({
          ...base,
          safeToken0: units(10000),
          positionToken0: units(10000),
          resetAmount0: units(100),
        })
      ).to.equal((units(20000) * 9950n) / 10000n - units(100));
    });

    it("caps at the module's daily room plus the OUSD the burn returns", () => {
      expect(
        fundableToken0({
          ...base,
          remainingToday: units(5000),
          positionToken0: units(15000),
        })
      ).to.equal((units(20000) * 9950n) / 10000n);
    });

    it("caps at the module's per-call cap and never goes negative", () => {
      expect(fundableToken0({ ...base, maxPerCall: units(1000) })).to.equal(
        units(1000)
      );
      expect(
        fundableToken0({ ...base, safeToken0: 0n, resetAmount0: units(1) })
      ).to.equal(0n);
    });
  });

  describe("resetAmount", () => {
    const limit = getSqrtPriceAtTick(4);
    it("resets only when the price sits above the range bottom", () => {
      expect(
        resetAmount({
          sqrtPriceX96: limit + 1n,
          sqrtLimitX96: limit,
          cap: units(100),
        })
      ).to.equal(units(100));
      expect(
        resetAmount({
          sqrtPriceX96: limit,
          sqrtLimitX96: limit,
          cap: units(100),
        })
      ).to.equal(0n);
    });
  });

  describe("position math", () => {
    const lower = getSqrtPriceAtTick(4);
    const upper = getSqrtPriceAtTick(5);

    it("holds only OUSD below the range and sizes ~20k OUSD on one tick", () => {
      const liquidity = liquidityForToken0(units(20000), lower, upper);
      const held = positionToken0(liquidity, lower, lower, upper);
      expect(Number(held) / 1e18).to.be.closeTo(20000, 1);
      expect(positionToken1(liquidity, lower, lower, upper)).to.equal(0n);
    });

    it("unpacks PositionInfo ticks", () => {
      const info = (BigInt(5) << 32n) | (BigInt(4) << 8n);
      expect(unpackTicks(info)).to.deep.equal([4, 5]);
      const negative =
        (BigInt(0x1000000 - 2238) << 32n) | (BigInt(0x1000000 - 2252) << 8n);
      expect(unpackTicks(negative)).to.deep.equal([-2252, -2238]);
    });
  });
});
