const { expect } = require("chai");
const { utils } = require("ethers");

const { compoundFixture } = require("../_fixture");
const { usdcUnits, loadFixture, isFork } = require("../helpers");

describe("Compound strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Should allow a withdraw", async () => {
    const { cStandalone, governor, usdc, cusdc } = await loadFixture(
      compoundFixture
    );

    const governorAddress = await governor.getAddress();
    const fakeVault = governor;
    const fakeVaultAddress = governorAddress;
    const stratCUSDBalance = await cusdc.balanceOf(cStandalone.address);

    await expect(await cStandalone.checkBalance(usdc.address)).to.be.equal("0");

    // Fund the fake "vault" (governor)
    await expect(await usdc.balanceOf(fakeVaultAddress)).to.be.equal(
      usdcUnits("1000")
    );

    // Give the strategy some funds
    await usdc
      .connect(fakeVault)
      .transfer(cStandalone.address, usdcUnits("1000"));
    await expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(
      usdcUnits("1000")
    );

    // Run deposit()
    await cStandalone
      .connect(fakeVault)
      .deposit(usdc.address, usdcUnits("1000"));

    const exchangeRate = await cusdc.exchangeRateStored();
    // 0xde0b6b3a7640000 == 1e18
    const expectedCusd = usdcUnits("1000")
      .mul("0xde0b6b3a7640000")
      .div(exchangeRate);
    // Make sure we have cUSD now
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.above(
      stratCUSDBalance
    );
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.equal(
      expectedCusd
    );
    await expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(
      usdcUnits("0")
    );

    // event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
    await expect(
      cStandalone
        .connect(fakeVault)
        .withdraw(fakeVaultAddress, usdc.address, usdcUnits("1000"))
    )
      .to.emit(cStandalone, "Withdrawal")
      .withArgs(usdc.address, cusdc.address, usdcUnits("1000"));

    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.equal(
      stratCUSDBalance
    );
  });

  it("Should collect rewards", async () => {
    const { cStandalone, vault, governor, harvester, usdc, comp } =
      await loadFixture(compoundFixture);
    const governorAddress = await governor.getAddress();
    const fakeVault = governor;
    const fakeVaultAddress = governorAddress;

    await expect(await cStandalone.checkBalance(usdc.address)).to.be.equal("0");

    // Fund the fake "vault" (governor)
    await expect(await usdc.balanceOf(fakeVaultAddress)).to.be.equal(
      usdcUnits("1000")
    );

    // Give the strategy some funds
    await usdc
      .connect(fakeVault)
      .transfer(cStandalone.address, usdcUnits("1000"));
    await expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(
      usdcUnits("1000")
    );

    // Approve compound on vault
    await vault.connect(governor).approveStrategy(cStandalone.address);

    await harvester
      .connect(governor)
      .setSupportedStrategy(cStandalone.address, true);

    // Run deposit()
    await cStandalone
      .connect(fakeVault)
      .deposit(usdc.address, usdcUnits("1000"));

    const compAmount = utils.parseUnits("100", 18);
    await comp.connect(governor).mint(compAmount);
    await comp.connect(governor).transfer(cStandalone.address, compAmount);

    // Make sure the Strategy has COMP balance
    await expect(await comp.balanceOf(governorAddress)).to.be.equal("0");
    await expect(await comp.balanceOf(cStandalone.address)).to.be.equal(
      compAmount
    );

    await harvester.connect(governor)["harvest(address)"](cStandalone.address);

    // Vault address on Compound Strategy is set to governor so they Should
    // receive the reward
    await expect(await comp.balanceOf(harvester.address)).to.be.equal(
      compAmount
    );
    await expect(await comp.balanceOf(cStandalone.address)).to.be.equal("0");
  });

  it("Should allow Governor to set reward token address", async () => {
    const { cStandalone, governor, comp } = await loadFixture(compoundFixture);
    await expect(
      cStandalone
        .connect(governor)
        .setRewardTokenAddresses([cStandalone.address])
    )
      .to.emit(cStandalone, "RewardTokenAddressesUpdated")
      .withArgs([comp.address], [cStandalone.address]);
    expect(await cStandalone.rewardTokenAddresses(0)).to.equal(
      cStandalone.address
    );
  });

  it("Should not allow non-Governor to set reward token address", async () => {
    const { cStandalone, anna } = await loadFixture(compoundFixture);
    await expect(
      cStandalone.connect(anna).setRewardTokenAddresses([cStandalone.address])
    ).to.be.revertedWith("Caller is not the Governor");
  });
});
