const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { isCI } = require("../helpers");
const { setERC20TokenBalance } = require("../_fund");

const { loadDefaultFixture } = require("../_fixture");

describe("ForkTest: CurvePoolBooster", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

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

  it("Should support Strategy as governor", async () => {
    const { simpleOETHHarvester } = fixture;
    const timelock = await ethers.provider.getSigner(
      addresses.mainnet.Timelock
    );

    expect(
      await simpleOETHHarvester.supportedStrategies(
        addresses.mainnet.ConvexOETHAMOStrategy
      )
    ).to.be.equal(false);
    await simpleOETHHarvester
      .connect(timelock)
      .setSupportedStrategy(addresses.mainnet.ConvexOETHAMOStrategy, true);
    expect(
      await simpleOETHHarvester.supportedStrategies(
        addresses.mainnet.ConvexOETHAMOStrategy
      )
    ).to.be.equal(true);
  });

  it("Should support Strategy as strategist", async () => {
    const { simpleOETHHarvester, strategist } = fixture;

    expect(
      await simpleOETHHarvester
        .connect(strategist)
        .supportedStrategies(addresses.mainnet.ConvexOETHAMOStrategy)
    ).to.be.equal(false);
    await simpleOETHHarvester
      .connect(strategist)
      .setSupportedStrategy(addresses.mainnet.ConvexOETHAMOStrategy, true);
    expect(
      await simpleOETHHarvester.connect(strategist).supportedStrategies(
        addresses.mainnet.ConvexOETHAMOStrategy
      )
    ).to.be.equal(true);
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

  it("Should revert if when setting strategist is not governor", async () => {
    const { simpleOETHHarvester, josh } = fixture;

    await expect(
      // prettier-ignore
      simpleOETHHarvester
        .connect(josh)
        .setStrategistAddr(josh.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should Set strategist", async () => {
    const { simpleOETHHarvester, josh } = fixture;
    const timelock = await ethers.provider.getSigner(
      addresses.mainnet.Timelock
    );

    expect(await simpleOETHHarvester.strategistAddr()).not.to.equal(
      josh.address
    );
    await simpleOETHHarvester.connect(timelock).setStrategistAddr(josh.address);
    expect(await simpleOETHHarvester.strategistAddr()).to.equal(josh.address);
  });

  it("Should Harvest and transfer rewards as strategist", async () => {
    const { simpleOETHHarvester, convexEthMetaStrategy, crv } = fixture;
    const strategistAddress = await simpleOETHHarvester.strategistAddr();
    const strategist = await ethers.provider.getSigner(strategistAddress);

    const balanceBeforeCRV = await crv.balanceOf(strategistAddress);
    await simpleOETHHarvester
      .connect(strategist)
      .setSupportedStrategy(convexEthMetaStrategy.address, true);
    // prettier-ignore
    await simpleOETHHarvester
      .connect(strategist)["harvestAndTransfer(address)"](convexEthMetaStrategy.address);

    const balanceAfterCRV = await crv.balanceOf(strategistAddress);
    expect(balanceAfterCRV).to.be.gt(balanceBeforeCRV);
  });

  it("Should Harvest and transfer rewards as governor", async () => {
    const { simpleOETHHarvester, convexEthMetaStrategy, crv } = fixture;
    const timelock = await ethers.provider.getSigner(
      addresses.mainnet.Timelock
    );
    const strategist = await simpleOETHHarvester.strategistAddr();

    const balanceBeforeCRV = await crv.balanceOf(strategist);
    await simpleOETHHarvester
      .connect(timelock)
      .setSupportedStrategy(convexEthMetaStrategy.address, true);
    // prettier-ignore
    await simpleOETHHarvester
      .connect(timelock)["harvestAndTransfer(address)"](convexEthMetaStrategy.address);

    const balanceAfterCRV = await crv.balanceOf(strategist);
    expect(balanceAfterCRV).to.be.gt(balanceBeforeCRV);
  });

  it("Should revert if strategy is not authorized", async () => {
    const { simpleOETHHarvester, convexEthMetaStrategy } = fixture;
    const timelock = await ethers.provider.getSigner(
      addresses.mainnet.Timelock
    );

    await expect(
      // prettier-ignore
      simpleOETHHarvester
        .connect(timelock)["harvestAndTransfer(address)"](convexEthMetaStrategy.address)
    ).to.be.revertedWith("Strategy not supported");
  });

  it("Should revert if strategy is address 0", async () => {
    const { simpleOETHHarvester } = fixture;
    const timelock = await ethers.provider.getSigner(
      addresses.mainnet.Timelock
    );

    await expect(
      // prettier-ignore
      simpleOETHHarvester
        .connect(timelock).setSupportedStrategy(addresses.zero, true)
    ).to.be.revertedWith("Invalid strategy");
  });

  it("Should test to rescue tokens as governor", async () => {
    const { simpleOETHHarvester, crv } = fixture;
    const timelock = await ethers.provider.getSigner(
      addresses.mainnet.Timelock
    );

    await setERC20TokenBalance(simpleOETHHarvester.address, crv, "1000");
    const balanceBeforeCRV = await crv.balanceOf(simpleOETHHarvester.address);
    await simpleOETHHarvester
      .connect(timelock)
      .transferToken(crv.address, "1000");
    const balanceAfterCRV = await crv.balanceOf(simpleOETHHarvester.address);
    expect(balanceAfterCRV).to.be.lt(balanceBeforeCRV);
  });

  it("Should test to rescue tokens as strategist", async () => {
    const { simpleOETHHarvester, crv } = fixture;
    const strategistAddress = await simpleOETHHarvester.strategistAddr();
    const strategist = await ethers.provider.getSigner(strategistAddress);

    await setERC20TokenBalance(simpleOETHHarvester.address, crv, "1000");
    const balanceBeforeCRV = await crv.balanceOf(simpleOETHHarvester.address);
    await simpleOETHHarvester
      .connect(strategist)
      .transferToken(crv.address, "1000");
    const balanceAfterCRV = await crv.balanceOf(simpleOETHHarvester.address);
    expect(balanceAfterCRV).to.be.lt(balanceBeforeCRV);
  });
});
