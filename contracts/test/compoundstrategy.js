const { expect } = require("chai");

const { defaultFixture } = require("./_fixture");
const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
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
  it("Should handle non-standard token deposits", async () => {
    let {
      ousd,
      vault,
      matt,
      oracle,
      governor,
      nonStandardToken,
    } = await loadFixture(defaultFixture);
    await oracle.setPrice("NonStandardToken", oracleUnits("1.00"));

    // Add a compoundStrategy
    const compoundStrategy = await ethers.getContract("CompoundStrategy");
    vault.connect(governor).addStrategy(compoundStrategy.address, 100);
    await nonStandardToken
      .connect(matt)
      .approve(vault.address, usdtUnits("10000"));

    // Try to mint more than balance, to check failure state
    try {
      await vault
        .connect(matt)
        .mint(nonStandardToken.address, usdtUnits("1200"));
    } catch (err) {
      expect(
        /revert SafeERC20: ERC20 operation did not succeed/gi.test(err.message)
      ).to.be.true;
    } finally {
      // Make sure nothing got affected
      await expectApproxSupply(ousd, ousdUnits("200.0"));
      await expect(matt).has.an.approxBalanceOf("100", ousd);
      await expect(matt).has.an.approxBalanceOf("1000", nonStandardToken);
    }

    // Try minting with a valid balance of tokens
    await vault.connect(matt).mint(nonStandardToken.address, usdtUnits("100"));
    await expect(matt).has.an.approxBalanceOf("900", nonStandardToken);

    await expectApproxSupply(ousd, ousdUnits("300.0"));
    await expect(matt).has.an.approxBalanceOf("200", ousd, "Initial");
    await vault.connect(governor).rebase();
    await expect(matt).has.an.approxBalanceOf("200", ousd, "After null rebase");
    await oracle.setPrice("NonStandardToken", oracleUnits("2.00"));
    await vault.connect(governor).rebase();

    await expectApproxSupply(ousd, ousdUnits("400.0"));
    await expect(matt).has.an.approxBalanceOf(
      "266.66",
      ousd,
      "After some assets double"
    );
  });
});
