const { mockVaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");

const { loadFixture } = require("../helpers");

describe("Vault mock with rebase", async () => {
  it("Should increase users balance on rebase after increased Vault value", async () => {
    const { mockVault, matt, ousd, josh } = await loadFixture(mockVaultFixture);
    // Total OUSD supply is 200, mock an increase
    await mockVault.setTotalValue(utils.parseUnits("220", 18));
    await mockVault.rebase();
    await expect(matt).has.an.approxBalanceOf("110.00", ousd);
    await expect(josh).has.an.approxBalanceOf("110.00", ousd);
  });

  it("Should not decrease users balance on rebase after decreased Vault value", async () => {
    const { mockVault, matt, ousd, josh } = await loadFixture(mockVaultFixture);
    // Total OUSD supply is 200, mock a decrease
    await mockVault.setTotalValue(utils.parseUnits("180", 18));
    await mockVault.rebase();
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("100.00", ousd);
  });

  it("Should not allow redeem if total supply and value are far apart", async () => {
    const { mockVault, governor, matt } = await loadFixture(mockVaultFixture);

    // Allow a 10% diff
    await mockVault
      .connect(governor)
      .setMaxSupplyDiff(utils.parseUnits("1", 17));

    // totalValue far exceeding totalSupply
    await mockVault.setTotalValue(utils.parseUnits("300", 18));
    expect(
      mockVault
        .connect(matt)
        .redeem(utils.parseUnits("100", 18), utils.parseUnits("100", 18))
    ).to.be.revertedWith("Backing supply liquidity error");

    // totalSupply far exceeding totalValue
    await mockVault.setTotalValue(utils.parseUnits("100", 18));
    expect(
      mockVault
        .connect(matt)
        .redeem(utils.parseUnits("100", 18), utils.parseUnits("100", 18))
    ).to.be.revertedWith("Backing supply liquidity error");

    // totalValue exceeding totalSupply but within limits
    await mockVault.setTotalValue(utils.parseUnits("220", 18));
    expect(
      mockVault
        .connect(matt)
        .redeem(utils.parseUnits("100", 18), utils.parseUnits("100", 18))
    ).to.not.be.reverted;

    // totalSupply exceeding totalValue but within limits
    await mockVault.setTotalValue(utils.parseUnits("180", 18));
    expect(
      mockVault
        .connect(matt)
        .redeem(utils.parseUnits("100", 18), utils.parseUnits("100", 18))
    ).to.not.be.reverted;
  });
});
