const { multiStrategyVaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");

const {
  daiUnits,
  ousdUnits,
  usdcUnits,
  loadFixture,
  isGanacheFork,
} = require("../helpers");

describe("Vault with two strategies", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should allocate correctly with equally weighted strategies", async () => {
    const {
      vault,
      viewVault,
      josh,
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

  it("Should allocate correctly with equally weighted strategies and varying decimals", async () => {
    const {
      vault,
      viewVault,
      josh,
      dai,
      usdc,
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
    await usdc.connect(josh).approve(vault.address, usdcUnits("22"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("22"));
    await vault.connect(governor).allocate();

    // Vault should select first Strategy attempting to match second at 50%
    expect(await compoundStrategy.checkBalance(usdc.address)).to.equal(
      usdcUnits("22")
    );

    // Vault should select the first Strategy again because it is below 50%
    await usdc.connect(josh).approve(vault.address, usdcUnits("178"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("178"));
    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(usdc.address)).to.equal(
      usdcUnits("200")
    );

    await usdc.connect(josh).approve(vault.address, usdcUnits("1"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("1"));
    await vault.connect(governor).allocate();

    expect(await strategyTwo.checkBalance(usdc.address)).to.equal(
      usdcUnits("1")
    );
  });

  it("Should withdraw from overweight strategy first", async () => {
    const {
      vault,
      viewVault,
      josh,
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
    await dai.connect(josh).approve(vault.address, daiUnits("210"));
    await vault.connect(josh).mint(dai.address, daiUnits("210"));
    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(dai.address)).to.equal(
      daiUnits("210")
    );
    expect(await strategyTwo.checkBalance(dai.address)).to.equal(
      daiUnits("200")
    );

    await vault.connect(josh).redeem(ousdUnits("20"));

    // Should withdraw from the heaviest strategy first
    expect(await compoundStrategy.checkBalance(dai.address)).to.equal(
      daiUnits("190")
    );

    await vault.connect(josh).redeem(ousdUnits("20"));

    expect(await strategyTwo.checkBalance(dai.address)).to.equal(
      daiUnits("180")
    );
  });

  it("Should withdraw from correct strategy with varying decimals", async () => {
    const {
      vault,
      viewVault,
      josh,
      dai,
      usdc,
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

    // Josh deposits USDC, 6 decimals
    await usdc.connect(josh).approve(vault.address, usdcUnits("210"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("210"));
    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(usdc.address)).to.equal(
      usdcUnits("210")
    );
    expect(await strategyTwo.checkBalance(dai.address)).to.equal(
      daiUnits("200")
    );

    await vault.connect(josh).redeem(ousdUnits("20"));

    // Although compoundStrategy is the heaviest strategy, we don't withdraw
    // the full amount because the outputs calculation dictates we must withdraw
    // some of each currency
    // 210 - 210e6/410e6 * 20
    expect(await compoundStrategy.checkBalance(usdc.address)).to.equal(
      usdcUnits("199.756098")
    );

    await vault.connect(josh).redeem(ousdUnits("20"));
  });
});
