const { expect } = require("chai");
const { utils } = require("ethers");
const { convexMetaVaultFixture } = require("../_fixture");

const {
  daiUnits,
  ousdUnits,
  units,
  loadFixture,
  expectApproxSupply,
  isFork,
} = require("../helpers");

describe("Convex 3pool/OUSD Meta Strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  let anna,
    ousd,
    vault,
    harvester,
    governor,
    crv,
    cvx,
    metaStrategy,
    metapoolToken,
    cvxBooster,
    usdt,
    usdc,
    dai;

  const mint = async (amount, asset) => {
    await asset.connect(anna).mint(units(amount, asset));
    await asset.connect(anna).approve(vault.address, units(amount, asset));
    return await vault
      .connect(anna)
      .mint(asset.address, units(amount, asset), 0);
  };

  beforeEach(async function () {
    const fixture = await loadFixture(convexMetaVaultFixture);
    anna = fixture.anna;
    vault = fixture.vault;
    harvester = fixture.harvester;
    ousd = fixture.ousd;
    governor = fixture.governor;
    crv = fixture.crv;
    cvx = fixture.cvx;
    metaStrategy = fixture.metaStrategy;
    metapoolToken = fixture.metapoolToken;
    cvxBooster = fixture.cvxBooster;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    dai = fixture.dai;
  });

  describe("Mint", function () {
    it("Should stake USDT in Curve gauge via metapool", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", usdt);
      await expectApproxSupply(ousd, ousdUnits("60200"));
      await expect(anna).to.have.a.balanceOf("30000", ousd);
      await expect(cvxBooster).has.an.approxBalanceOf("60000", metapoolToken);
    });

    it("Should stake USDC in Curve gauge via metapool", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("50000.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("100200"));
      await expect(anna).to.have.a.balanceOf("50000", ousd);
      await expect(cvxBooster).has.an.approxBalanceOf("100000", metapoolToken);
    });

    it("Should use a minimum LP token amount when depositing USDT into metapool", async function () {
      await expect(mint("29000", usdt)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });

    it("Should use a minimum LP token amount when depositing USDC into metapool", async function () {
      await expect(mint("29000", usdc)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });
  });

  describe("Redeem", function () {
    it("Should be able to unstake from gauge and return USDT", async function () {
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

  describe("Utilities", function () {
    it("Should allow transfer of arbitrary token by Governor", async () => {
      await dai.connect(anna).approve(vault.address, daiUnits("8.0"));
      await vault.connect(anna).mint(dai.address, daiUnits("8.0"), 0);
      // Anna sends her OUSD directly to Strategy
      await ousd.connect(anna).transfer(metaStrategy.address, ousdUnits("8.0"));
      // Anna asks Governor for help
      await metaStrategy
        .connect(governor)
        .transferToken(ousd.address, ousdUnits("8.0"));
      await expect(governor).has.a.balanceOf("8.0", ousd);
    });

    it("Should not allow transfer of arbitrary token by non-Governor", async () => {
      // Naughty Anna
      await expect(
        metaStrategy.connect(anna).transferToken(ousd.address, ousdUnits("8.0"))
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("Harvest", function () {
    it("Should allow the strategist to call harvest for a specific strategy", async () => {
      // prettier-ignore
      await harvester
        .connect(governor)["harvest(address)"](metaStrategy.address);
    });

    it("Should collect reward tokens using collect rewards on all strategies", async () => {
      // Mint of MockCRVMinter mints a fixed 2e18
      await harvester.connect(governor)["harvest()"]();
      await expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      await expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });

    it("Should collect reward tokens using collect rewards on a specific strategy", async () => {
      await expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("0", 18)
      );
      await expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("0", 18)
      );

      await harvester.connect(governor)[
        // eslint-disable-next-line
        "harvest(address)"
      ](metaStrategy.address);

      await expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      await expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });
  });
});
