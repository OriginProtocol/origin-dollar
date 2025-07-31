const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { isCI, oethUnits } = require("../helpers");
const { setERC20TokenBalance } = require("../_fund");

const { loadDefaultFixture } = require("../_fixture");

describe("ForkTest: SimpleHarvester", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  // --- Initial Parameters ---
  it("Should have correct parameters", async () => {
    const { simpleOETHHarvester } = fixture;
    const { multichainStrategistAddr } = await getNamedAccounts();

    expect(await simpleOETHHarvester.governor()).to.be.equal(
      addresses.mainnet.Timelock
    );

    expect(await simpleOETHHarvester.strategistAddr()).to.be.equal(
      multichainStrategistAddr
    );
  });

  // --- Harvest and Transfer Rewards ---
  it("Should Harvest and transfer rewards (out of WETH) as strategist", async () => {
    const { simpleOETHHarvester, convexEthMetaStrategy, crv, strategist } =
      fixture;

    await ensureStrategyIsSupported(
      simpleOETHHarvester,
      convexEthMetaStrategy.address,
      strategist
    );

    const balanceBeforeCRV = await crv.balanceOf(strategist.address);
    // prettier-ignore
    await simpleOETHHarvester
      .connect(strategist)["harvestAndTransfer(address)"](convexEthMetaStrategy.address);

    const balanceAfterCRV = await crv.balanceOf(strategist.address);
    expect(balanceAfterCRV).to.be.gt(balanceBeforeCRV);
  });

  it("Should Harvest and transfer rewards (only of WETH) as strategist", async () => {
    const {
      simpleOETHHarvester,
      nativeStakingSSVStrategy,
      weth,
      strategist,
      oethVault,
      josh,
      nativeStakingFeeAccumulator,
    } = fixture;

    // Send ETH to the FeeAccumulator to simulate yield.
    await josh.sendTransaction({
      to: nativeStakingFeeAccumulator.address,
      value: oethUnits("1"),
    });

    const balanceBeforeWETH = await weth.balanceOf(oethVault.address);
    // prettier-ignore
    await simpleOETHHarvester
      .connect(strategist)["harvestAndTransfer(address)"](nativeStakingSSVStrategy.address);

    const balanceAfterWETH = await weth.balanceOf(oethVault.address);
    expect(balanceAfterWETH).to.be.gte(balanceBeforeWETH.add(oethUnits("1")));
  });

  it("Should Harvest and transfer rewards (out of WETH) as governor", async () => {
    const {
      simpleOETHHarvester,
      convexEthMetaStrategy,
      strategist,
      timelock,
      crv,
    } = fixture;

    const balanceBeforeCRV = await crv.balanceOf(strategist.address);
    // prettier-ignore
    await simpleOETHHarvester
      .connect(timelock)["harvestAndTransfer(address)"](convexEthMetaStrategy.address);

    const balanceAfterCRV = await crv.balanceOf(strategist.address);
    expect(balanceAfterCRV).to.be.gt(balanceBeforeCRV);
  });

  it("Should Harvest and transfer rewards (only of WETH) as governor", async () => {
    const {
      simpleOETHHarvester,
      nativeStakingSSVStrategy,
      weth,
      timelock,
      oethVault,
      josh,
      nativeStakingFeeAccumulator,
    } = fixture;

    // Send ETH to the FeeAccumulator to simulate yield.
    await josh.sendTransaction({
      to: nativeStakingFeeAccumulator.address,
      value: oethUnits("1"),
    });

    const balanceBeforeWETH = await weth.balanceOf(oethVault.address);
    // prettier-ignore
    await simpleOETHHarvester
      .connect(timelock)["harvestAndTransfer(address)"](nativeStakingSSVStrategy.address);

    const balanceAfterWETH = await weth.balanceOf(oethVault.address);
    expect(balanceAfterWETH).to.be.gte(balanceBeforeWETH.add(oethUnits("1")));
  });

  it("Should revert if strategy is not authorized", async () => {
    const { simpleOETHHarvester, convexEthMetaStrategy, timelock } = fixture;

    await simpleOETHHarvester
      .connect(timelock)
      .setSupportedStrategy(addresses.mainnet.ConvexOETHAMOStrategy, false);

    await expect(
      // prettier-ignore
      simpleOETHHarvester
        .connect(timelock)["harvestAndTransfer(address)"](convexEthMetaStrategy.address)
    ).to.be.revertedWith("Strategy not supported");
  });

  // --- Support Strategies ---
  it("Should unsupport Strategy as governor", async () => {
    const { simpleOETHHarvester, timelock } = fixture;
    await simpleOETHHarvester
      .connect(timelock)
      .setSupportedStrategy(addresses.mainnet.ConvexOETHAMOStrategy, false);
    expect(
      await simpleOETHHarvester.supportedStrategies(
        addresses.mainnet.ConvexOETHAMOStrategy
      )
    ).to.be.equal(false);
  });

  it("Should unsupport Strategy as strategist", async () => {
    const { simpleOETHHarvester, strategist } = fixture;

    await simpleOETHHarvester
      .connect(strategist)
      .setSupportedStrategy(addresses.mainnet.ConvexOETHAMOStrategy, false);
    expect(
      await simpleOETHHarvester
        .connect(strategist)
        .supportedStrategies(addresses.mainnet.ConvexOETHAMOStrategy)
    ).to.be.equal(false);
  });

  it("Should revert if support strategy is not governor or strategist", async () => {
    const { simpleOETHHarvester, josh } = fixture;

    await expect(
      // prettier-ignore
      simpleOETHHarvester
        .connect(josh)
        .setSupportedStrategy(addresses.mainnet.ConvexOETHAMOStrategy, true)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should revert if strategy is address 0", async () => {
    const { simpleOETHHarvester, timelock } = fixture;

    await expect(
      // prettier-ignore
      simpleOETHHarvester
        .connect(timelock).setSupportedStrategy(addresses.zero, true)
    ).to.be.revertedWith("Invalid strategy");
  });

  // --- Set Strategist ---
  it("Should revert when setting strategist is not governor", async () => {
    const { simpleOETHHarvester, josh } = fixture;

    await expect(
      // prettier-ignore
      simpleOETHHarvester
        .connect(josh)
        .setStrategistAddr(josh.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should Set strategist", async () => {
    const { simpleOETHHarvester, timelock, josh } = fixture;

    expect(await simpleOETHHarvester.strategistAddr()).not.to.equal(
      josh.address
    );
    await simpleOETHHarvester.connect(timelock).setStrategistAddr(josh.address);
    expect(await simpleOETHHarvester.strategistAddr()).to.equal(josh.address);
  });

  it("Should Harvest and transfer rewards as strategist", async () => {
    const { simpleOETHHarvester, convexEthMetaStrategy, crv, strategist } =
      fixture;

    const balanceBeforeCRV = await crv.balanceOf(strategist.address);
    await simpleOETHHarvester
      .connect(strategist)
      .setSupportedStrategy(convexEthMetaStrategy.address, true);
    // prettier-ignore
    await simpleOETHHarvester
      .connect(strategist)["harvestAndTransfer(address)"](convexEthMetaStrategy.address);

    const balanceAfterCRV = await crv.balanceOf(strategist.address);
    expect(balanceAfterCRV).to.be.gt(balanceBeforeCRV);
  });

  it("Should Harvest and transfer rewards as governor", async () => {
    const {
      simpleOETHHarvester,
      convexEthMetaStrategy,
      strategist,
      timelock,
      crv,
    } = fixture;

    const balanceBeforeCRV = await crv.balanceOf(strategist.address);

    await simpleOETHHarvester
      .connect(timelock)
      .setSupportedStrategy(convexEthMetaStrategy.address, true);
    // prettier-ignore
    await simpleOETHHarvester
      .connect(timelock)["harvestAndTransfer(address)"](convexEthMetaStrategy.address);

    const balanceAfterCRV = await crv.balanceOf(strategist.address);
    expect(balanceAfterCRV).to.be.gt(balanceBeforeCRV);
  });

  it("Should revert if strategy is not authorized", async () => {
    const { simpleOETHHarvester, convexEthMetaStrategy, timelock } = fixture;

    await simpleOETHHarvester
      .connect(timelock)
      .setSupportedStrategy(addresses.mainnet.ConvexOETHAMOStrategy, false);

    await expect(
      // prettier-ignore
      simpleOETHHarvester
        .connect(timelock)["harvestAndTransfer(address)"](convexEthMetaStrategy.address)
    ).to.be.revertedWith("Strategy not supported");
  });

  it("Should revert if strategy is address 0", async () => {
    const { simpleOETHHarvester, timelock } = fixture;

    await expect(
      // prettier-ignore
      simpleOETHHarvester
        .connect(timelock).setSupportedStrategy(addresses.zero, true)
    ).to.be.revertedWith("Invalid strategy");
  });

  it("Should test to rescue tokens as governor", async () => {
    const { simpleOETHHarvester, timelock, crv } = fixture;

    await setERC20TokenBalance(simpleOETHHarvester.address, crv, "1000");
    const balanceBeforeCRV = await crv.balanceOf(simpleOETHHarvester.address);
    await simpleOETHHarvester
      .connect(timelock)
      .transferToken(crv.address, "1000");
    const balanceAfterCRV = await crv.balanceOf(simpleOETHHarvester.address);
    expect(balanceAfterCRV).to.be.lt(balanceBeforeCRV);
  });

  it("Should test to rescue tokens as strategist", async () => {
    const { simpleOETHHarvester, strategist, crv } = fixture;

    await setERC20TokenBalance(simpleOETHHarvester.address, crv, "1000");
    const balanceBeforeCRV = await crv.balanceOf(simpleOETHHarvester.address);
    await simpleOETHHarvester
      .connect(strategist)
      .transferToken(crv.address, "1000");
    const balanceAfterCRV = await crv.balanceOf(simpleOETHHarvester.address);
    expect(balanceAfterCRV).to.be.lt(balanceBeforeCRV);
  });

  // --- Set Dripper ---
  it("Should Set Dripper as governor", async () => {
    const { simpleOETHHarvester, timelock, josh } = fixture;

    await simpleOETHHarvester.connect(timelock).setDripper(josh.address);

    expect(await simpleOETHHarvester.dripper()).to.equal(josh.address);
  });

  it("Should revert when setting dripper due to address 0", async () => {
    const { simpleOETHHarvester, timelock } = fixture;

    await expect(
      simpleOETHHarvester.connect(timelock).setDripper(addresses.zero)
    ).to.be.revertedWith("Invalid dripper");
  });

  const ensureStrategyIsSupported = async (harvester, strategy, strategist) => {
    if (!(await harvester.supportedStrategies(strategy))) {
      await harvester.connect(strategist).setSupportedStrategy(strategy, true);
    }
  };
});
