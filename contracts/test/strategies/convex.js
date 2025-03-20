const { expect } = require("chai");

const { createFixtureLoader, convexVaultFixture } = require("../_fixture");
const {
  usdsUnits,
  ousdUnits,
  units,
  expectApproxSupply,
  isFork,
} = require("../helpers");

describe("Convex Strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  let anna,
    ousd,
    vault,
    governor,
    crv,
    threePoolToken,
    convexStrategy,
    cvxBooster,
    usdt,
    usdc,
    usds;

  const mint = async (amount, asset) => {
    await asset.connect(anna).mint(await units(amount, asset));
    await asset
      .connect(anna)
      .approve(vault.address, await units(amount, asset));
    return await vault
      .connect(anna)
      .mint(asset.address, await units(amount, asset), 0);
  };

  const loadFixture = createFixtureLoader(convexVaultFixture);
  beforeEach(async function () {
    const fixture = await loadFixture();
    anna = fixture.anna;
    vault = fixture.vault;
    ousd = fixture.ousd;
    governor = fixture.governor;
    crv = fixture.crv;
    threePoolToken = fixture.threePoolToken;
    convexStrategy = fixture.convexStrategy;
    cvxBooster = fixture.cvxBooster;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    usds = fixture.usds;
  });

  describe("Mint", function () {
    it("Should stake USDT in Curve gauge via 3pool", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      await expect(anna).to.have.a.balanceOf("30000", ousd);
      await expect(cvxBooster).has.an.approxBalanceOf("30000", threePoolToken);
    });

    it("Should stake USDC in Curve gauge via 3pool", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("50000.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("50200"));
      await expect(anna).to.have.a.balanceOf("50000", ousd);
      await expect(cvxBooster).has.an.approxBalanceOf("50000", threePoolToken);
    });

    it("Should use a minimum LP token amount when depositing USDT into 3pool", async function () {
      await expect(mint("29000", usdt)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });

    it("Should use a minimum LP token amount when depositing USDC into 3pool", async function () {
      await expect(mint("29000", usdc)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });
  });

  describe("Redeem", function () {
    it("Should be able to unstake from gauge and return USDT", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("10000.00", usds);
      await mint("10000.00", usdc);
      await mint("10000.00", usdt);
      await vault.connect(anna).redeem(ousdUnits("20000"), 0);
      await expectApproxSupply(ousd, ousdUnits("10200"));
    });
  });

  describe("Utilities", function () {
    it("Should allow transfer of arbitrary token by Governor", async () => {
      await usds.connect(anna).approve(vault.address, usdsUnits("8.0"));
      await vault.connect(anna).mint(usds.address, usdsUnits("8.0"), 0);
      // Anna sends her OUSD directly to Strategy
      await ousd
        .connect(anna)
        .transfer(convexStrategy.address, ousdUnits("8.0"));
      // Anna asks Governor for help
      await convexStrategy
        .connect(governor)
        .transferToken(ousd.address, ousdUnits("8.0"));
      await expect(governor).has.a.balanceOf("8.0", ousd);
    });

    it("Should not allow transfer of arbitrary token by non-Governor", async () => {
      // Naughty Anna
      await expect(
        convexStrategy
          .connect(anna)
          .transferToken(ousd.address, ousdUnits("8.0"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should revert when zero address attempts to be set as reward token address", async () => {
      await expect(
        convexStrategy
          .connect(governor)
          .setRewardTokenAddresses([
            crv.address,
            "0x0000000000000000000000000000000000000000",
          ])
      ).to.be.revertedWith("Can not set an empty address as a reward token");
    });
  });
});
