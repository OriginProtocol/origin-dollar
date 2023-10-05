const { expect } = require("chai");

const { createFixtureLoader, convexFrxEthFixture } = require("../_fixture");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");

const { isFork } = require("../helpers");
const addresses = require("../../utils/addresses");

describe("Convex frxETH/ETH Strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  const loadFixture = createFixtureLoader(convexFrxEthFixture);
  let fixture;
  beforeEach(async function () {
    fixture = await loadFixture();
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.convexFrxEthWethStrategy,
  }));

  // shouldBehaveLikeHarvester(() => ({
  //   ...fixture,
  //   strategy: fixture.convexFrxEthWethStrategy,
  //   harvester: fixture.oethHarvester,
  //   rewards: [
  //     { asset: fixture.crv, expected: parseUnits("2") },
  //     { asset: fixture.cvx, expected: parseUnits("3") },
  //   ],
  // }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    strategy: fixture.convexFrxEthWethStrategy,
    assets: [fixture.weth, fixture.frxETH],
    vault: fixture.oethVault,
  }));

  describe("Setup", () => {
    it("Should have immutables set", async () => {
      const { frxETH, weth, convexFrxEthWethStrategy } = fixture;
      expect(await convexFrxEthWethStrategy.CURVE_BASE_ASSETS()).to.equal(2);
      expect(await convexFrxEthWethStrategy.coin0()).to.equal(weth.address);
      expect(await convexFrxEthWethStrategy.coin1()).to.equal(frxETH.address);
      expect(await convexFrxEthWethStrategy.coin2()).to.equal(addresses.zero);
      expect(await convexFrxEthWethStrategy.decimals0()).to.equal(18);
      expect(await convexFrxEthWethStrategy.decimals1()).to.equal(18);
      expect(await convexFrxEthWethStrategy.decimals2()).to.equal(0);
    });
    it("Should not be able to remove platform tokens", async () => {
      const { frxETH, weth, convexFrxEthWethStrategy } = fixture;
      await expect(
        convexFrxEthWethStrategy.removePToken(weth.address)
      ).to.be.revertedWith("Unsupported");
      await expect(
        convexFrxEthWethStrategy.removePToken(frxETH.address)
      ).to.be.revertedWith("Unsupported");
    });
  });
});
