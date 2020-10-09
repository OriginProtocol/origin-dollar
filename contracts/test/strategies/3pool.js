const { expect } = require("chai");

const { threepoolVaultFixture } = require("../_fixture");
const {
  ousdUnits,
  units,
  loadFixture,
  expectApproxSupply,
  isGanacheFork,
} = require("../helpers");

describe.only("3Pool Strategy", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  let anna,
    ousd,
    vault,
    threePoolToken,
    threePoolGauge,
    curveUSDCStrategy,
    curveUSDTStrategy,
    usdt,
    usdc,
    dai;

  const mint = async (amount, asset) => {
    await asset.connect(anna).mint(units(amount, asset));
    await asset.connect(anna).approve(vault.address, units(amount, asset));
    await vault.connect(anna).mint(asset.address, units(amount, asset));
  };

  beforeEach(async function () {
    const fixture = await loadFixture(threepoolVaultFixture);
    anna = fixture.anna;
    vault = fixture.vault;
    ousd = fixture.ousd;
    threePoolToken = fixture.threePoolToken;
    threePoolGauge = fixture.threePoolGauge;
    curveUSDCStrategy = fixture.curveUSDCStrategy;
    curveUSDTStrategy = fixture.curveUSDTStrategy;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    dai = fixture.dai;
  });

  describe("Mint", function () {
    it("Should stake USDT in Curve gauge via 3pool", async function () {
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
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("50000.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("50200"));
      await expect(anna).to.have.a.balanceOf("50000", ousd);
      await expect(threePoolGauge).has.an.approxBalanceOf(
        "50000",
        threePoolToken
      );
    });

    it("Should not send DAI to any 3pool strategy", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", dai);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      await expect(curveUSDCStrategy).has.an.approxBalanceOf(
        "0",
        threePoolToken
      );
      await expect(curveUSDTStrategy).has.an.approxBalanceOf(
        "0",
        threePoolToken
      );
      await vault.connect(anna).redeem(ousdUnits("30000.00"));
    });

    it("Should be able to unstake from gauge and return USDT", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", usdt);
      await vault.connect(anna).redeem(ousdUnits("20000"));
      await expectApproxSupply(ousd, ousdUnits("10200"));
    });

    it("Should be able to unstake from gauge and return assets after multiple mints", async function () {
      await mint("30000.00", usdt);
      await mint("30000.00", usdc);
      await mint("30000.00", dai);
      await vault.connect(anna).redeem(ousdUnits("60000.00"));
      // Anna had 1000 of each asset before the mints
      // 200 DAI was already in the Vault
      // 30200 DAI, 30000 USDT, 30000 USDC
      // 30200 / 90200 * 30000 + 1000 DAI
      // 30000 / 90200 * 30000 + 1000 USDC and USDT
      await expect(anna).to.have.an.approxBalanceOf("21088.69", dai);
      await expect(anna).to.have.an.approxBalanceOf("20955.65", usdc);
      await expect(anna).to.have.an.approxBalanceOf("20955.65", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"));
    });
  });
});
