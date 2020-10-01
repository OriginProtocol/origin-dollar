const { expect } = require("chai");

const { defaultFixture, threepoolFixture, threepoolVaultFixture } = require("../_fixture");
const {
  daiUnits,
  usdcUnits,
  usdtUnits,
  ousdUnits,
  units,
  loadFixture,
  expectApproxSupply,
  isGanacheFork,
} = require("../helpers");

const { withTracing } = require("../_trace");

const mint = async (vault, user, amount, asset) => {
  await asset.connect(user).mint(units(amount, asset));
  await asset.connect(user).approve(vault.address, units(amount, asset));
  await vault.connect(user).mint(asset.address, units(amount, asset));
}


describe.only("3Pool Strategy", function(){
  if (isGanacheFork) {
    this.timeout(0);
  }
  describe("Mint", function () {
    it("should mint USDT", async function () {
      const {
        anna,
        governor,
        vault,
        ousd,
        threePoolToken,
        threePoolStrategy,
        usdt,
        dai,
      } = await loadFixture(threepoolVaultFixture);

      await expectApproxSupply(ousd, ousdUnits("200"))
      await mint(vault, anna, "30000.00", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"))

      await expect(threePoolStrategy).has.an.approxBalanceOf(
        "29965.92",
        threePoolToken
      );

      
      await vault.connect(anna).redeem(ousdUnits("20000.00"))
      await expectApproxSupply(ousd, ousdUnits("10200"))



      // await vault.connect(governor).allocate()
      

    });
  });
})

