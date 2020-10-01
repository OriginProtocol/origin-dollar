const { expect } = require("chai");

const {
  defaultFixture,
  threepoolFixture,
  threepoolVaultFixture,
} = require("../_fixture");
const {
  daiUnits,
  usdcUnits,
  usdtUnits,
  ousdUnits,
  humanBalance,
  units,
  loadFixture,
  expectApproxSupply,
  isGanacheFork,
} = require("../helpers");

const { withTracing } = require("../_trace");

describe.only("3Pool Strategy", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  let anna,
    governor,
    ousd,
    vault,
    threePoolToken,
    threePoolStrategy,
    usdt,
    usdc,
    dai;

  const mint = async (amount, asset) => {
    await asset.connect(anna).mint(units(amount, asset));
    await asset.connect(anna).approve(vault.address, units(amount, asset));
    await vault.connect(anna).mint(asset.address, units(amount, asset));
  };

  const getBalances = async (user) => {
    return {
      dai: await humanBalance(user, dai),
      usdc: await humanBalance(user, usdc),
      usdt: await humanBalance(user, usdt),
      ousd: await humanBalance(user, ousd),
    };
  };

  beforeEach(async function () {
    const fixture = await loadFixture(threepoolVaultFixture);
    anna = fixture.anna;
    governor = fixture.governor;
    vault = fixture.vault;
    ousd = fixture.ousd;
    threePoolToken = fixture.threePoolToken;
    threePoolStrategy = fixture.threePoolStrategy;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    dai = fixture.dai;
  });

  describe("Mint", function () {
    it("should mint USDT", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      await expect(anna).to.have.a.balanceOf("30000", ousd);
      await expect(threePoolStrategy).has.an.approxBalanceOf(
        "29965.92",
        threePoolToken
      );
      await vault.connect(anna).redeem(ousdUnits("20000.00"));
    });
    it("should mint USDC", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      await expect(anna).to.have.a.balanceOf("30000", ousd);
      await expect(threePoolStrategy).has.an.approxBalanceOf(
        "29990.22",
        threePoolToken
      );
      await vault.connect(anna).redeem(ousdUnits("20000.00"));
    });
    it("should not send DAI to threepool", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", dai);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      await expect(threePoolStrategy).has.an.approxBalanceOf(
        "0",
        threePoolToken
      );
      await vault.connect(anna).redeem(ousdUnits("30000.00"));
    });
    it("should redeem", async function () {
      await mint("30000.00", usdt);
      await vault.connect(anna).redeem(ousdUnits("20000.00"));
      await expectApproxSupply(ousd, ousdUnits("10174.057"));
    });
    it("should redeem after multiple mints", async function () {
      await expect(anna).to.have.an.approxBalanceOf("1000.00", dai);
      await expect(anna).to.have.an.approxBalanceOf("1000.00", usdc);
      await expect(anna).to.have.an.approxBalanceOf("1000.00", usdt);
      await mint("30000.00", usdt);
      await mint("30000.00", usdc);
      await mint("30000.00", dai);
      await vault.connect(anna).redeem(ousdUnits("60000.00"));
      await expect(anna).to.have.an.approxBalanceOf("21094.42", dai);
      await expect(anna).to.have.an.approxBalanceOf("20944.00", usdc);
      await expect(anna).to.have.an.approxBalanceOf("20961.00", usdt);
      await expectApproxSupply(ousd, ousdUnits("30176.52"));
    });
  });
});
