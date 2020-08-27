const { expect } = require("chai");
const { utils } = require("ethers");

const { defaultFixture } = require("./_fixture");
const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  oracleUnits,
  expectApproxSupply,
  loadFixture,
  isGanacheFork,
} = require("./helpers");

describe("Compound Strategy", () => {
  it("Should alter balances after an asset price change", async () => {
    let { ousd, vault, matt, oracle, governor, usdc, dai } = await loadFixture(
      defaultFixture
    );
    // Add a compoundStrategy
    compoundStrategy = await ethers.getContract("CompoundStrategy");
    vault.connect(governor).addStrategy(compoundStrategy.address, 100);
    await usdc.connect(matt).approve(vault.address, usdcUnits("200"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("200"));
    await dai.connect(matt).approve(vault.address, daiUnits("200"));
    await vault.connect(matt).mint(dai.address, daiUnits("200"));

    await expectApproxSupply(ousd, ousdUnits("600.0"));
    await expect(matt).has.an.approxBalanceOf("500", ousd, "Initial");
    await vault.connect(governor).rebase();
    await expect(matt).has.an.approxBalanceOf("500", ousd, "After null rebase");
    await oracle.setPrice("USDC", oracleUnits("2.00"));
    await vault.connect(governor).rebase();
    await expectApproxSupply(ousd, ousdUnits("800.0"));
    await expect(matt).has.an.approxBalanceOf(
      "666.66",
      ousd,
      "After some assets double"
    );
    await oracle.setPrice("USDC", oracleUnits("1.00"));
    await vault.connect(governor).rebase();
    await expectApproxSupply(ousd, ousdUnits("600.0"));
    await expect(matt).has.an.approxBalanceOf(
      "500",
      ousd,
      "After assets go back"
    );
  });
});
