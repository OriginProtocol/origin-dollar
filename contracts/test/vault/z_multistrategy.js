const { multiStrategyVaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");

const { daiUnits, usdtUnits, loadFixture, isFork } = require("../helpers");

describe("Vault with two strategies", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Should reallocate from one strategy to another", async () => {
    const {
      vault,
      viewVault,
      dai,
      governor,
      compoundStrategy,
      strategyTwo,
    } = await loadFixture(multiStrategyVaultFixture);

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    await vault.allocate();

    expect(await compoundStrategy.checkBalance(dai.address)).to.equal(
      daiUnits("0")
    );
    expect(await strategyTwo.checkBalance(dai.address)).to.equal(
      daiUnits("200")
    );

    await vault
      .connect(governor)
      .reallocate(
        strategyTwo.address,
        compoundStrategy.address,
        [dai.address],
        [daiUnits("200")]
      );

    expect(await compoundStrategy.checkBalance(dai.address)).to.equal(
      daiUnits("200")
    );
    expect(await strategyTwo.checkBalance(dai.address)).to.equal(daiUnits("0"));
  });

  it("Should not reallocate to a strategy that does not support the asset", async () => {
    const {
      vault,
      viewVault,
      usdt,
      josh,
      governor,
      compoundStrategy,
      strategyTwo,
    } = await loadFixture(multiStrategyVaultFixture);

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // CompoundStrategy supports DAI, USDT and USDC but StrategyTwo only
    // supports DAI and USDC, see compoundVaultFixture() and
    // multiStrategyVaultFixture() in test/_fixture.js

    // Stick 200 USDT in CompoundStrategy via mint and allocate
    await usdt.connect(josh).approve(vault.address, usdtUnits("200"));
    await vault.connect(josh).mint(usdt.address, usdtUnits("200"));
    await vault.allocate();

    expect(await compoundStrategy.checkBalance(usdt.address)).to.equal(
      usdtUnits("200")
    );

    await expect(
      vault
        .connect(governor)
        .reallocate(
          compoundStrategy.address,
          strategyTwo.address,
          [usdt.address],
          [usdtUnits("200")]
        )
    ).to.be.revertedWith("Asset unsupported");
  });

  it("Should not reallocate to strategy that has not been added to the Vault", async () => {
    const {
      vault,
      dai,
      governor,
      compoundStrategy,
      strategyThree,
    } = await loadFixture(multiStrategyVaultFixture);
    await expect(
      vault
        .connect(governor)
        .reallocate(
          compoundStrategy.address,
          strategyThree.address,
          [dai.address],
          [daiUnits("200")]
        )
    ).to.be.revertedWith("Invalid to Strategy");
  });

  it("Should not reallocate from strategy that has not been added to the Vault", async () => {
    const {
      vault,
      dai,
      governor,
      compoundStrategy,
      strategyThree,
    } = await loadFixture(multiStrategyVaultFixture);
    await expect(
      vault
        .connect(governor)
        .reallocate(
          strategyThree.address,
          compoundStrategy.address,
          [dai.address],
          [daiUnits("200")]
        )
    ).to.be.revertedWith("Invalid from Strategy");
  });
});
