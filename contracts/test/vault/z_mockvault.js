const { mockVaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");

const { loadFixture } = require("../helpers");

describe("Vault mock with rebase", async () => {
  it("Should increase users balance on rebase after increased Vault value", async () => {
    const { vault, matt, ousd, josh } = await loadFixture(mockVaultFixture);
    // Total OUSD supply is 200, mock an increase
    await vault.setTotalValue(utils.parseUnits("220", 18));
    await vault.rebase();
    await expect(matt).has.an.approxBalanceOf("110.00", ousd);
    await expect(josh).has.an.approxBalanceOf("110.00", ousd);
  });

  it("Should not decrease users balance on rebase after decreased Vault value", async () => {
    const { vault, matt, ousd, josh } = await loadFixture(mockVaultFixture);
    // Total OUSD supply is 200, mock a decrease
    await vault.setTotalValue(utils.parseUnits("180", 18));
    await vault.rebase();
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("100.00", ousd);
  });

  it.only("should not tranfer more than expected", async () => {
    let { ousd, vault, matt, josh, anna, tusd } = await loadFixture(
      mockVaultFixture
    );

    let i = 0
    const logBalance = async () => {
      console.log('----', i++)
      for (const user of [josh, matt, anna]) {
        // Clear the existing balances
        // await vault.connect(user).redeem(100);
        console.log(utils.formatUnits(await ousd.balanceOf(await user.getAddress()), 18))
      }
      console.log('----', i)
    }

    await logBalance()


    for (const user of [josh, matt]) {
      // Clear the existing balances
      await vault.connect(user).redeem(await ousd.balanceOf(await user.getAddress()));
    }

    await logBalance()

    console.log('Minting 333333333.....33333333 tokens')
    for (const user of [josh, matt, anna]) {
      const tokens = '333333333333333333333333333333333333333333333333333333';

      await tusd.connect(user).mint(tokens);
      await tusd.connect(user).approve(vault.address, tokens);
      await vault.connect(user).mint(tusd.address, tokens);
    }

    await logBalance()

    console.log('Setting totalSupply to 15 and doing a rebase...')
    await vault.setTotalValue(utils.parseUnits('15', 18));
    await vault.rebase();

    await logBalance()

    console.log('Minting 16 tokens...')
    await tusd.connect(anna).mint(utils.parseUnits('16', 18))
    await tusd.connect(anna).approve(vault.address, utils.parseUnits('16', 18));
    await vault.connect(anna).mint(tusd.address, utils.parseUnits('16', 18));

    await logBalance()

    console.log('Transferring more than that...')
    expect(
      ousd
        .connect(anna)
        .transfer(await matt.getAddress(), '333333333333333333333333333333333350333333333333333333')
    ).to.be.revertedWith("Transfer amount exceeds balance")
  });
});
