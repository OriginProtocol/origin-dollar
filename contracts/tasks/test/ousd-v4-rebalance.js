const { expect } = require("chai");
const { BigNumber } = require("ethers");

const {
  fundableToken0,
  liquidityForToken0,
  pendingToken1,
  planRebalance,
  positionToken0,
  unpackTicks,
} = require("../actions/ousdV4Rebalance");
const { getSqrtPriceAtTick } = require("../lib/v4TickMath");

// Talos makes every decision the module no longer makes: when to pull, how
// much to re-add, and the reset swap's price limit. Pin each of them.
describe("Unit: ousdV4Rebalance", () => {
  const bn = (v) => BigNumber.from(v);
  const TARGET = bn("80014000349982500743725934");
  const RESET = bn("1000000000000000000000");
  const base = {
    priceInRange: true,
    pendingToken1: bn("5000000000000000000000"),
    liquidity: TARGET,
    targetLiquidity: TARGET,
    minToken1: bn("10000000000000000000"),
    safeToken1: bn(0),
    maxToken1InSafe: bn("1000000000000000000000000"),
    resetAmount0: RESET,
  };
  const plan = (overrides) => planRebalance({ ...base, ...overrides });

  describe("planRebalance", () => {
    it("pulls, resets and re-adds the target when the position holds token1", () => {
      const p = plan({});
      expect(p.send).to.equal(true);
      expect(p.liquidityToAdd.eq(TARGET)).to.equal(true);
      expect(p.resetAmount0.eq(RESET)).to.equal(true);
    });

    it("skips dust", () => {
      expect(plan({ pendingToken1: bn("9999999999999999999") }).why).to.equal(
        "Dust"
      );
    });

    it("pulls without re-adding or resetting at the exposure cap", () => {
      const p = plan({ safeToken1: bn("999000000000000000000000") });
      expect(p.send).to.equal(true);
      expect(p.liquidityToAdd.isZero()).to.equal(true);
      expect(p.resetAmount0.isZero()).to.equal(true);
    });

    it("re-adds an emptied position whose price is still in range", () => {
      const p = plan({ liquidity: bn(0), pendingToken1: bn(0) });
      expect(p.why).to.equal("Re-add");
      expect(p.liquidityToAdd.eq(TARGET)).to.equal(true);
      expect(p.resetAmount0.eq(RESET)).to.equal(true);
    });

    it("tops up below the range without a reset", () => {
      const p = plan({
        priceInRange: false,
        pendingToken1: bn(0),
        liquidity: bn(0),
      });
      expect(p.why).to.equal("Top up");
      expect(p.liquidityToAdd.eq(TARGET)).to.equal(true);
      expect(p.resetAmount0.isZero()).to.equal(true);
    });

    it("does not top up within 1% of the target", () => {
      const p = plan({
        priceInRange: false,
        pendingToken1: bn(0),
        liquidity: TARGET.mul(995).div(1000),
      });
      expect(p.why).to.equal("Balanced");
    });

    it("does nothing below the range at the target", () => {
      expect(plan({ priceInRange: false, pendingToken1: bn(0) }).send).to.equal(
        false
      );
    });
  });

  describe("pendingToken1", () => {
    const lower = bn(getSqrtPriceAtTick(0).toString());
    const upper = bn(getSqrtPriceAtTick(5).toString());

    it("is zero at or below the range", () => {
      expect(
        pendingToken1({
          liquidity: TARGET,
          sqrtPriceX96: lower,
          sqrtLowerX96: lower,
          sqrtUpperX96: upper,
        }).isZero()
      ).to.equal(true);
    });

    it("is ~20k USDe for the live position once the range is crossed", () => {
      const full = pendingToken1({
        liquidity: TARGET,
        sqrtPriceX96: upper.mul(2),
        sqrtLowerX96: lower,
        sqrtUpperX96: upper,
      });
      expect(Number(full.div(bn(10).pow(18)))).to.be.closeTo(20000, 50);
    });
  });

  describe("unpackTicks", () => {
    const pack = (lower, upper) =>
      bn(upper & 0xffffff)
        .shl(32)
        .or(bn(lower & 0xffffff).shl(8));

    it("reads the live position's range", () => {
      expect(unpackTicks(pack(0, 5))).to.deep.equal([0, 5]);
    });

    it("sign-extends negative ticks", () => {
      expect(unpackTicks(pack(-2252, -2238))).to.deep.equal([-2252, -2238]);
    });
  });

  describe("getSqrtPriceAtTick", () => {
    // Values from v4-core TickMath (and the module's fork tests).
    it("matches v4-core exactly", () => {
      expect(getSqrtPriceAtTick(0)).to.equal(79228162514264337593543950336n);
      expect(getSqrtPriceAtTick(1)).to.equal(79232123823359799118286999568n);
      expect(getSqrtPriceAtTick(5)).to.equal(79247971040445709311708648151n);
      expect(getSqrtPriceAtTick(-1)).to.equal(79224201403219477170569942574n);
      expect(getSqrtPriceAtTick(-887272)).to.equal(4295128739n);
      expect(getSqrtPriceAtTick(887272)).to.equal(
        1461446703485210103287273052203988822378723970342n
      );
    });

    it("rejects ticks out of range", () => {
      expect(() => getSqrtPriceAtTick(887273)).to.throw("Invalid tick");
    });
  });

  describe("--target-ousd", () => {
    const e18 = bn(10).pow(18);
    const lower = bn(getSqrtPriceAtTick(0).toString());
    const upper = bn(getSqrtPriceAtTick(5).toString());

    it("turns 20k OUSD on [0, 5] into the live position's liquidity", () => {
      const l = liquidityForToken0({
        amount0: bn(20000).mul(e18),
        sqrtLowerX96: lower,
        sqrtUpperX96: upper,
      });
      // The live position: 20k OUSD minted for 80014000349982500743725934.
      expect(Number(l.sub(TARGET).abs().mul(1e6).div(TARGET))).to.be.lessThan(
        1
      );
    });

    it("counts the OUSD a position holds below, in and above its range", () => {
      const at = (sqrtPriceX96) =>
        Number(
          positionToken0({
            liquidity: TARGET,
            sqrtPriceX96,
            sqrtLowerX96: lower,
            sqrtUpperX96: upper,
          }).div(e18)
        );
      expect(at(lower.sub(1))).to.be.closeTo(20000, 1);
      expect(at(lower.add(upper).div(2))).to.be.closeTo(10000, 20);
      expect(at(upper)).to.equal(0);
    });

    it("caps the target at what the Safe can fund, less margin and reset", () => {
      const fund = (safe, inPosition, reset = 0) =>
        Number(
          fundableToken0({
            targetToken0: bn(20000).mul(e18),
            safeToken0: bn(safe).mul(e18),
            positionToken0: bn(inPosition).mul(e18),
            resetAmount0: bn(reset).mul(e18),
          }).div(e18)
        );
      expect(fund(7, 14407)).to.equal(14341); // (7 + 14407) * 99.5%
      expect(fund(7, 14407, 100)).to.equal(14241);
      expect(fund(30000, 14407)).to.equal(20000);
      expect(fund(0, 0, 100)).to.equal(0);
    });
  });
});
