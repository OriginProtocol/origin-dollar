const { expect } = require("chai");
const { utils } = require("ethers");

const { createFixtureLoader, mockVaultFixture } = require("../_fixture");

describe("Vault mock with rebase", async () => {
  let mockVault, matt, ousd, josh, governor;
  beforeEach(async () => {
    const loadFixture = createFixtureLoader(mockVaultFixture);
    const fixture = await loadFixture(mockVaultFixture);
    mockVault = fixture.mockVault;
    matt = fixture.matt;
    ousd = fixture.ousd;
    josh = fixture.josh;
    governor = fixture.governor;

    // Allow a 10% diff
    await mockVault
      .connect(governor)
      .setMaxSupplyDiff(utils.parseUnits("1", 17));
  });

  it("Should increase users balance on rebase after increased Vault value", async () => {
    // Total OUSD supply is 200, mock an increase
    await mockVault.setTotalValue(utils.parseUnits("220", 18));
    await mockVault.rebase();
    await expect(matt).has.an.approxBalanceOf("110.00", ousd);
    await expect(josh).has.an.approxBalanceOf("110.00", ousd);
  });

  it("Should not decrease users balance on rebase after decreased Vault value", async () => {
    // Total OUSD supply is 200, mock a decrease
    await mockVault.setTotalValue(utils.parseUnits("180", 18));
    await mockVault.rebase();
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("100.00", ousd);
  });

  const testSupplyDiff = async ({
    vaultTotalValue,
    redeemAmount,
    revertMessage = false,
  }) => {
    /* mockVault doesn't reduce total value while redeeming (as the real Vault does)
     * for that reason we set an already reduced total value to it
     */
    await mockVault.setTotalValue(
      utils.parseUnits(`${vaultTotalValue - redeemAmount}`, 18)
    );
    const promise = expect(
      mockVault
        .connect(matt)
        .redeem(
          utils.parseUnits(`${redeemAmount}`, 18),
          utils.parseUnits(`${redeemAmount}`, 18)
        )
    );

    if (revertMessage) {
      await promise.to.be.revertedWith(revertMessage);
    } else {
      await promise.to.not.be.reverted;
    }
  };

  it("Should revert when totalValue far exceeding totalSupply", async () => {
    // totalValue far exceeding totalSupply
    await testSupplyDiff({
      vaultTotalValue: 300,
      redeemAmount: 100,
      revertMessage: "Backing supply liquidity error",
      mockVault,
      matt,
    });
  });

  it("Should revert when totalSupply far exceeding totalValue", async () => {
    // totalValue far exceeding totalSupply
    await testSupplyDiff({
      vaultTotalValue: 170,
      redeemAmount: 100,
      revertMessage: "Backing supply liquidity error",
      mockVault,
      matt,
    });
  });

  it("Should pass when totalValue exceeding totalSupply but within limits", async () => {
    // totalValue exceeding totalSupply but within limits
    await testSupplyDiff({
      vaultTotalValue: 209, // 209 - 100 = 109 -> 9% over total supply
      redeemAmount: 100,
      revertMessage: false,
      mockVault,
      matt,
    });
  });

  it("Should pass when totalSupply exceeding totalValue but within limits", async () => {
    await testSupplyDiff({
      vaultTotalValue: 191, // 191 - 100 = 91 -> 9% under total supply
      redeemAmount: 100,
      revertMessage: false,
      mockVault,
      matt,
    });
  });
});
