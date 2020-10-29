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

  it(
    "Should allocate correctly when one strategy doesn't support deposit asset"
  );

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

  it(
    "Should withdraw from correct strategy when one strategy doesn't support withdrawal asset"
  );

  it("Should allocate to both strategies even if their weights are lopsided",  async () => {
    const {
      vault,
      viewVault,
      josh,
      dai,
      usdc,
      governor,
      compoundStrategy,
      strategyTwo,
      strategyThree,
    } = await loadFixture(multiStrategyVaultFixture);

    await vault
      .connect(governor)
      .addStrategy(strategyThree.address, utils.parseUnits("1", 18));

    await vault
    .connect(governor)
    .setStrategyWeights(
      [compoundStrategy.address, strategyTwo.address, strategyThree.address],
      ["0", "0", utils.parseUnits("1", 18)]
    );

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );
    await dai.connect(josh).approve(vault.address, daiUnits("200"));
    await vault.connect(josh).mint(dai.address, daiUnits("200"));
    await vault.connect(governor).allocate();


    // This is to simulate a large allocation to a strategy handling only one token DAI
    expect(await strategyThree.checkBalance(dai.address)).to.equal(
      daiUnits("400")
    );


    // give strategy two 50% and compound strategy 5%
    // minting usdc so strategyThree doesn't matter since it only supports Dai
    await vault
    .connect(governor)
    .setStrategyWeights(
      [compoundStrategy.address, strategyTwo.address],
      [utils.parseUnits("5", 16), utils.parseUnits("5", 17)]
    );

    // Josh deposits USDC, 6 decimals
    await usdc.connect(josh).approve(vault.address, usdcUnits("20"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("20"));
    await vault.connect(governor).allocate();

    // Strategy Two should have 200 because it should have 10x more than Compound Strategy
    expect(await strategyTwo.checkBalance(usdc.address)).to.equal(
      usdcUnits("20")
    ); 

    await usdc.connect(josh).approve(vault.address, usdcUnits("2"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("2"));
    await vault.connect(governor).allocate();
  
    // compound should get the next allocate because it'll stay at 10x less than strategy two
    expect(await strategyTwo.checkBalance(usdc.address)).to.equal(
      usdcUnits("20")
    );
    expect(await compoundStrategy.checkBalance(usdc.address)).to.equal(
      usdcUnits("2")
    );

  }) ;
});
