const { expect } = require("chai");

const { defaultFixture } = require("./_fixture");
const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  oracleUnits,
  expectApproxSupply,
  loadFixture,
} = require("./helpers");

describe("Compound Strategy", () => {
  it("Should alter balances after an asset price change", async () => {
    let { ousd, vault, matt, oracle, governor, usdc, dai } = await loadFixture(
      defaultFixture
    );
    // Add a compoundStrategy
    const compoundStrategy = await ethers.getContract("CompoundStrategy");
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

  it("Should allow transfer of arbitrary token by Governor", async () => {
    const { vault, ousd, usdc, matt, governor } = await loadFixture(
      defaultFixture
    );
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"));
    // Matt sends his OUSD directly to Vault
    await ousd.connect(matt).transfer(vault.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await vault.connect(governor).transferToken(ousd.address, ousdUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow transfer of arbitrary token by non-Governor", async () => {
    const { vault, ousd, matt } = await loadFixture(defaultFixture);
    // Naughty Matt
    await expect(
      vault.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });
});
