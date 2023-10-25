const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { parseUnits } = require("ethers/lib/utils");

const { convexMetaVaultFixture, createFixtureLoader } = require("../_fixture");
const { ousdUnits, units, expectApproxSupply, isFork } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvester } = require("../behaviour/harvester");

describe("OUSD AMO strategy using Curve OUSD/3CRV pool", function () {
  if (isFork) {
    this.timeout(0);
  }

  const loadFixture = createFixtureLoader(convexMetaVaultFixture);
  let fixture;
  beforeEach(async function () {
    fixture = await loadFixture();
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.OUSDmetaStrategy,
  }));

  shouldBehaveLikeHarvester(() => ({
    ...fixture,
    strategy: fixture.OUSDmetaStrategy,
    dripAsset: fixture.usdt,
    rewards: [
      { asset: fixture.crv, expected: parseUnits("2") },
      { asset: fixture.cvx, expected: parseUnits("3") },
    ],
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
    it("Should stake USDT in Curve gauge via metapool", async function () {
      const { anna, cvxBooster, ousd, metapoolToken, usdt } = fixture;
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", usdt);
      await expectApproxSupply(ousd, ousdUnits("60200"));
      await expect(anna).to.have.a.balanceOf("30000", ousd);
      await expect(cvxBooster).has.an.approxBalanceOf("60000", metapoolToken);
    });

    it("Should stake USDC in Curve gauge via metapool", async function () {
      const { anna, cvxBooster, ousd, metapoolToken, usdc } = fixture;
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("50000.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("100200"));
      await expect(anna).to.have.a.balanceOf("50000", ousd);
      await expect(cvxBooster).has.an.approxBalanceOf("100000", metapoolToken);
    });

    it("Should use a minimum LP token amount when depositing USDT into metapool", async function () {
      const { usdt } = fixture;
      await expect(mint("29000", usdt)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });

    it("Should use a minimum LP token amount when depositing USDC into metapool", async function () {
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
      // Dai minted OUSD has not been deployed to Metastrategy for that reason the
      // total supply of OUSD has not doubled
      await expectApproxSupply(ousd, ousdUnits("10200"));
    });
  });

  describe("AMO", function () {
    it("Should not allow too large mintForStrategy", async () => {
      const { vault, governor, anna } = fixture;
      const MAX_UINT = BigNumber.from(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );

      await vault.connect(governor).setOusdMetaStrategy(anna.address);

      await expect(
        vault.connect(anna).mintForStrategy(MAX_UINT)
      ).to.be.revertedWith("Amount too high");

      await expect(
        vault.connect(anna).mintForStrategy(MAX_UINT.div(2).sub(1))
      ).to.be.revertedWith(
        "Minted ousd surpassed netOusdMintForStrategyThreshold."
      );
    });

    it("Should not allow too large burnForStrategy", async () => {
      const { vault, governor, anna } = fixture;
      const MAX_UINT = BigNumber.from(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );

      await vault.connect(governor).setOusdMetaStrategy(anna.address);

      await expect(
        vault.connect(anna).burnForStrategy(MAX_UINT)
      ).to.be.revertedWith("Amount too high");

      await expect(
        vault.connect(anna).burnForStrategy(MAX_UINT.div(2).sub(1))
      ).to.be.revertedWith("Attempting to burn too much OUSD.");
    });
  });
});
