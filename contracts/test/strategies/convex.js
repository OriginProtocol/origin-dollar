const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const {
  createFixtureLoader,
  convexVaultFixture,
} = require("../fixture/_fixture");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvester } = require("../behaviour/harvester");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");

const { ousdUnits, units, expectApproxSupply, isFork } = require("../helpers");

describe("Convex Strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  const loadFixture = createFixtureLoader(convexVaultFixture);
  let fixture;
  beforeEach(async function () {
    fixture = await loadFixture();
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.convexStrategy,
  }));

  shouldBehaveLikeHarvester(() => ({
    ...fixture,
    strategy: fixture.convexStrategy,
    dripAsset: fixture.usdt,
    rewards: [
      { asset: fixture.crv, expected: parseUnits("2") },
      { asset: fixture.cvx, expected: parseUnits("3") },
    ],
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    strategy: fixture.convexStrategy,
    assets: [fixture.dai, fixture.usdc, fixture.usdt],
    vault: fixture.vault,
  }));

  const mint = async (amount, asset) => {
    const { anna, vault } = fixture;
    await asset.connect(anna).mint(await units(amount, asset));
    await asset
      .connect(anna)
      .approve(vault.address, await units(amount, asset));
    return await vault
      .connect(anna)
      .mint(asset.address, await units(amount, asset), 0);
  };

  describe("Setup", () => {
    it("Should have immutables set", async () => {
      const { dai, usdc, usdt, convexStrategy } = fixture;
      expect(await convexStrategy.CURVE_POOL_ASSETS_COUNT()).to.equal(3);
      expect(await convexStrategy.coin0()).to.equal(dai.address);
      expect(await convexStrategy.coin1()).to.equal(usdc.address);
      expect(await convexStrategy.coin2()).to.equal(usdt.address);
      expect(await convexStrategy.decimals0()).to.equal(18);
      expect(await convexStrategy.decimals1()).to.equal(6);
      expect(await convexStrategy.decimals2()).to.equal(6);
    });
  });

  describe("Mint", function () {
    it("Should stake USDT in Curve gauge via 3pool", async function () {
      const { ousd, usdt, anna, cvxBooster, threePoolToken } = fixture;
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      await expect(anna).to.have.a.balanceOf("30000", ousd);
      await expect(cvxBooster).has.an.approxBalanceOf("30000", threePoolToken);
    });

    it("Should stake USDC in Curve gauge via 3pool", async function () {
      const { ousd, usdc, anna, cvxBooster, threePoolToken } = fixture;
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("50000.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("50200"));
      await expect(anna).to.have.a.balanceOf("50000", ousd);
      await expect(cvxBooster).has.an.approxBalanceOf("50000", threePoolToken);
    });

    it("Should use a minimum LP token amount when depositing USDT into 3pool", async function () {
      const { usdt } = fixture;
      await expect(mint("29000", usdt)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });

    it("Should use a minimum LP token amount when depositing USDC into 3pool", async function () {
      const { usdc } = fixture;
      await expect(mint("29000", usdc)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });
  });
});
