const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { isCI } = require("../helpers");

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
    const { deployerAddr } = await getNamedAccounts();

    expect(await simpleOETHHarvester.governor()).to.be.equal(
      addresses.mainnet.Timelock
    );
    expect(await simpleOETHHarvester.strategist()).to.be.equal(deployerAddr);
  });

  it("Should support Strategy", async () => {
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

  it("Should Set strategist", async () => {
    const { simpleOETHHarvester, josh } = fixture;
    const timelock = await ethers.provider.getSigner(
      addresses.mainnet.Timelock
    );

    expect(await simpleOETHHarvester.strategist()).not.to.equal(josh.address);
    await simpleOETHHarvester.connect(timelock).setStrategist(josh.address);
    expect(await simpleOETHHarvester.strategist()).to.equal(josh.address);
  });

  it("Should Harvest and transfer rewards", async () => {
    const { simpleOETHHarvester, convexEthMetaStrategy, crv } = fixture;
    const timelock = await ethers.provider.getSigner(
      addresses.mainnet.Timelock
    );
    const strategist = await simpleOETHHarvester.strategist();

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
});
