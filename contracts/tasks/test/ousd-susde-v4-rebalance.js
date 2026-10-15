const { expect } = require("chai");

const {
  ceilSqrt,
  fundableToken0,
  liquidityForToken0,
  navRange,
  planRebalance,
  positionToken0,
  positionToken1,
  resetAmount,
  unpackTicks,
} = require("../actions/ousdSusdeV4Rebalance");
const { getSqrtPriceAtTick } = require("../lib/v4TickMath");

const E18 = BigInt(10) ** BigInt(18);

// The module only enforces the NAV floor; Talos picks the range, the price
// limit and when to move. Pin each of them.
describe("Unit: ousdSusdeV4Rebalance", () => {
  // convertToShares(1e18) ~ 0.7984e18 puts the NAV tick near -2255.6.
  const shares = BigInt("798400000000000000");
  const NAV = (shares << BigInt(192)) / E18;

  describe("ceilSqrt", () => {
    it("is the smallest root at or above", () => {
      for (const n of [
        BigInt(0),
        BigInt(1),
        BigInt(2),
        BigInt(3),
        BigInt(4),
        BigInt(15),
        BigInt(16),
        BigInt(17),
        NAV,
        NAV + BigInt(1),
      ]) {
        const r = ceilSqrt(n);
        expect(r * r >= n).to.equal(true);
        if (r > BigInt(0))
          expect((r - BigInt(1)) * (r - BigInt(1)) < n).to.equal(true);
      }
    });
  });

  describe("navRange", () => {
    it("starts at the smallest tick at or above the NAV", () => {
      const r = navRange(NAV, 5);
      expect(r.tickLower).to.equal(Math.ceil(r.navTick));
      expect(r.tickUpper).to.equal(r.tickLower + 5);
      const lower = getSqrtPriceAtTick(r.tickLower);
      expect(lower * lower >= NAV).to.equal(true);
      const below = getSqrtPriceAtTick(r.tickLower - 1);
      expect(below * below < NAV).to.equal(true);
    });

    it("limits the reset at the smallest sqrtPrice at or above the NAV", () => {
      const { sqrtLimitX96 } = navRange(NAV, 5);
      expect(sqrtLimitX96 * sqrtLimitX96 >= NAV).to.equal(true);
      expect((sqrtLimitX96 - BigInt(1)) ** BigInt(2) < NAV).to.equal(true);
    });

    // Live at block 26196980: NAV tick -2256.68. The 1 bp floor reaches -2257.
    it("targets -2257 from the 1 bp floor where the strict NAV gives -2256", () => {
      const nav =
        (BigInt("797993817856042827") << BigInt(192)) /
        BigInt(10) ** BigInt(18);
      expect(navRange(nav, 5).tickLower).to.equal(-2256);
      const floor = (nav * BigInt(9999)) / BigInt(10000);
      const r = navRange(floor, 5);
      expect(r.tickLower).to.equal(-2257);
      expect(r.tickUpper).to.equal(-2252);
    });

    it("lands on the tick itself when the NAV is exactly a tick price", () => {
      const s = getSqrtPriceAtTick(-2255);
      const r = navRange(s * s, 5);
      expect(r.tickLower).to.equal(-2255);
      expect(r.sqrtLimitX96).to.equal(s);
    });

    it("rejects a bad width", () => {
      expect(() => navRange(NAV, 0)).to.throw("Invalid width");
    });
  });

  describe("planRebalance", () => {
    const base = {
      tokenId: BigInt(457274),
      liquidity: BigInt(10) ** BigInt(24),
      tickLower: -2255,
      token1: BigInt(0),
      minToken1: BigInt(10) * E18,
      targetLower: -2255,
      maxDrift: 2,
    };
    const plan = (o) => planRebalance({ ...base, ...o });

    it("leaves a position in place", () => {
      expect(plan({}).send).to.equal(false);
      expect(plan({ tickLower: -2254 }).send).to.equal(false);
    });

    it("moves once the NAV drifted max-drift ticks below the range", () => {
      expect(plan({ tickLower: -2253 }).why).to.equal("Drift");
      // Today's position: [-2252, -2238] against a NAV near -2255.6.
      expect(plan({ tickLower: -2252, targetLower: -2255 }).why).to.equal(
        "Drift"
      );
    });

    it("moves a position below the NAV", () => {
      expect(plan({ tickLower: -2256 }).why).to.equal("Below NAV");
    });

    it("moves a position that sold OUSD", () => {
      expect(plan({ token1: BigInt(10) * E18 }).why).to.equal("Filled");
      expect(plan({ token1: BigInt(10) * E18 - BigInt(1) }).send).to.equal(
        false
      );
    });

    it("mints when there is no live position", () => {
      expect(plan({ tokenId: BigInt(0) }).why).to.equal("Mint");
      expect(plan({ liquidity: BigInt(0) }).why).to.equal("Mint");
    });
  });

  describe("resetAmount", () => {
    const limit = BigInt(1000);
    it("resets only above the limit", () => {
      expect(
        resetAmount({
          sqrtPriceX96: BigInt(1001),
          sqrtLimitX96: limit,
          cap: BigInt(5),
        })
      ).to.equal(BigInt(5));
      expect(
        resetAmount({
          sqrtPriceX96: BigInt(1000),
          sqrtLimitX96: limit,
          cap: BigInt(5),
        })
      ).to.equal(BigInt(0));
      expect(
        resetAmount({
          sqrtPriceX96: BigInt(999),
          sqrtLimitX96: limit,
          cap: BigInt(5),
        })
      ).to.equal(BigInt(0));
    });
  });

  describe("liquidity math", () => {
    const lower = getSqrtPriceAtTick(-2256);
    const upper = getSqrtPriceAtTick(-2251);

    it("round-trips OUSD through liquidity below the range", () => {
      const amount = BigInt(20000) * E18;
      const l = liquidityForToken0(amount, lower, upper);
      const back = positionToken0(l, lower - BigInt(1), lower, upper);
      expect(amount - back >= BigInt(0)).to.equal(true);
      expect(amount - back < BigInt(10) ** BigInt(6)).to.equal(true);
      expect(positionToken1(l, lower - BigInt(1), lower, upper)).to.equal(
        BigInt(0)
      );
    });

    it("holds only sUSDe above the range", () => {
      const l = BigInt(10) ** BigInt(24);
      expect(positionToken0(l, upper + BigInt(1), lower, upper)).to.equal(
        BigInt(0)
      );
      expect(positionToken1(l, upper + BigInt(1), lower, upper)).to.equal(
        (l * (upper - lower)) / (BigInt(1) << BigInt(96))
      );
    });
  });

  describe("fundableToken0", () => {
    it("caps the target at the Safe's OUSD less margin and reset", () => {
      const f = (o) =>
        fundableToken0({
          target: BigInt(20000) * E18,
          safeToken0: BigInt(0),
          positionToken0: BigInt(0),
          resetAmount0: BigInt(0),
          ...o,
        });
      expect(f({ safeToken0: BigInt(100000) * E18 })).to.equal(
        BigInt(20000) * E18
      );
      expect(
        f({ safeToken0: BigInt(10000) * E18, positionToken0: BigInt(0) })
      ).to.equal(BigInt(9950) * E18);
      expect(
        f({
          positionToken0: BigInt(10000) * E18,
          resetAmount0: BigInt(100) * E18,
        })
      ).to.equal(BigInt(9850) * E18);
      expect(f({ resetAmount0: BigInt(1) })).to.equal(BigInt(0));
    });
  });

  describe("unpackTicks", () => {
    it("reads negative ticks", () => {
      const enc = (t) => BigInt(t < 0 ? t + 0x1000000 : t);
      const info =
        (enc(-2238) << BigInt(32)) | (enc(-2252) << BigInt(8)) | BigInt(0x7f);
      expect(unpackTicks(info)).to.deep.equal([-2252, -2238]);
    });
  });
});
