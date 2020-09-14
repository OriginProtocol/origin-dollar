const { multiStrategyVaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { BigNumber, utils } = require("ethers");

const {
  advanceTime,
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  loadFixture,
  isGanacheFork,
  expectApproxSupply,
} = require("../helpers");

describe("Vault with two strategies", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it.only("Should allocate correctly with equally weighted strategies", async () => {
    const {
      vault,
      viewVault,
      josh,
      matt,
      dai,
      governor,
      compoundStrategy,
      strategyTwo,
    } = await loadFixture(multiStrategyVaultFixture);

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    await vault.allocate();

    // First strategy should have 0 balance because vault allocates to last
    // strategy furtherest from weight
    expect(await compoundStrategy.checkBalance(dai.address)).to.equal(
      daiUnits("0")
    );
    expect(await strategyTwo.checkBalance(dai.address)).to.equal(
      daiUnits("200")
    );

    // Josh deposits DAI, 18 decimals
    await dai.connect(josh).approve(vault.address, daiUnits("22"));
    await vault.connect(josh).mint(dai.address, daiUnits("22"));
    await vault.connect(governor).allocate();

    // Vault should select first Strategy attempting to match second at 50%
    expect(await compoundStrategy.checkBalance(dai.address)).to.equal(
      daiUnits("22")
    );

    // Vault should select the first Strategy again because it is below 50%
    await dai.connect(josh).approve(vault.address, daiUnits("178"));
    await vault.connect(josh).mint(dai.address, daiUnits("178"));
    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(dai.address)).to.equal(
      daiUnits("200")
    );

    await dai.connect(josh).approve(vault.address, daiUnits("1"));
    await vault.connect(josh).mint(dai.address, daiUnits("1"));
    await vault.connect(governor).allocate();

    expect(await strategyTwo.checkBalance(dai.address)).to.equal(
      daiUnits("201")
    );
  });
});
