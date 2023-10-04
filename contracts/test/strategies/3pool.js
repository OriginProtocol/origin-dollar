const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { createFixtureLoader, threepoolVaultFixture } = require("../_fixture");
const { ousdUnits, units, expectApproxSupply, isFork } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvester } = require("../behaviour/harvester");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");

describe("3Pool Strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  const loadFixture = createFixtureLoader(threepoolVaultFixture);
  let fixture;
  beforeEach(async function () {
    fixture = await loadFixture();

    const { vault, governor, usdc, usdt, crvMinter, threePoolStrategy } =
      fixture;

    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdc.address, threePoolStrategy.address);
    await vault
      .connect(fixture.governor)
      .setAssetDefaultStrategy(usdt.address, threePoolStrategy.address);

    await crvMinter.connect(governor).mint(threePoolStrategy.address);
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.threePoolStrategy,
  }));

  shouldBehaveLikeHarvester(() => ({
    ...fixture,
    strategy: fixture.threePoolStrategy,
    rewards: [{ asset: fixture.crv, expected: parseUnits("2") }],
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    strategy: fixture.threePoolStrategy,
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

  describe("Mint", function () {
    it("Should stake USDT in Curve gauge via 3pool", async function () {
      const { ousd, usdt, anna, threePoolGauge, threePoolToken } = fixture;
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      await expect(anna).to.have.a.balanceOf("30000", ousd);
      await expect(threePoolGauge).has.an.approxBalanceOf(
        "30000",
        threePoolToken
      );
    });

    it("Should stake USDC in Curve gauge via 3pool", async function () {
      const { ousd, usdc, anna, threePoolGauge, threePoolToken } = fixture;
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("50000.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("50200"));
      await expect(anna).to.have.a.balanceOf("50000", ousd);
      await expect(threePoolGauge).has.an.approxBalanceOf(
        "50000",
        threePoolToken
      );
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

  describe("Redeem", function () {
    it("Should be able to unstake from gauge and return USDT", async function () {
      const { dai, usdc, usdt, ousd, anna, vault } = fixture;
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("10000.00", dai);
      await mint("10000.00", usdc);
      await mint("10000.00", usdt);
      await vault.connect(anna).redeem(ousdUnits("20000"), 0);
      await expectApproxSupply(ousd, ousdUnits("10200"));
    });
  });
});
