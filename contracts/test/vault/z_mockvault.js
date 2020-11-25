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
        console.log(utils.formatUnits(await ousd.balanceOf(await user.getAddress()), 18))
      }
      console.log('----', i)
    }

    for (const user of [josh, matt]) {
      // Clear the existing balances
      await vault.connect(user).redeem(await ousd.balanceOf(await user.getAddress()));
    }

    console.log('Minting 1000 tokens')
    for (const user of [josh, matt, anna]) {
      const tokens = '1000';

      await tusd.connect(user).mint(tokens);
      await tusd.connect(user).approve(vault.address, tokens);
      await vault.connect(user).mint(tusd.address, tokens);
    }

    await logBalance()

    console.log('Setting totalSupply to 99 and doing a rebase...')
    await vault.setTotalValue(99);
    await vault.rebase();

    console.log('rebaseOptOut')
    await ousd.connect(matt).rebaseOptOut()
    await ousd.connect(josh).rebaseOptOut()

    console.log('Setting totalSupply to 99 and doing a rebase...')
    await vault.setTotalValue('1233242342321323232323234434343412332423423213232323232');
    await vault.rebase();

    await logBalance()

    // console.log('Minting 16 tokens...')
    // await tusd.connect(anna).mint(16)
    // await tusd.connect(anna).approve(vault.address, 16);
    // await vault.connect(anna).mint(tusd.address, 16);

    // await logBalance()

    // console.log('Transferring more than that...')
    // expect(
    //   ousd
    //     .connect(anna)
    //     .transfer(await matt.getAddress(), '333333333333333333333333333333333350333333333333333333')
    // ).to.be.revertedWith("Transfer amount exceeds balance")
  });
});
