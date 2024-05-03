const { expect } = require("chai");

const addresses = require("../../utils/addresses");

describe("ForkTest: Harvest AERO", function () {
  this.timeout(0);

  let harvester;
  beforeEach(async () => {
    const AeroWethOracle = await ethers.getContractFactory("AeroWEthPriceFeed");
    let aeroWethOracle = await AeroWethOracle.deploy(
      addresses.base.ethUsdPriceFeed,
      addresses.base.aeroUsdPriceFeed
    );
    const AeroHarvester = await ethers.getContractFactory("AeroHarvester");
    harvester = await AeroHarvester.deploy(
      aeroWethOracle.address,
      addresses.base.wethTokenAddress
    );
    await harvester.deployed();
    await harvester.setRewardTokenConfig(
      addresses.base.aeroTokenAddress,
      {
        allowedSlippageBps: 300,
        harvestRewardBps: 100,
        swapPlatform: 0, // Aerodrome
        swapPlatformAddr: addresses.base.aeroRouterAddress,
        liquidationLimit: 0,
        doSwapRewardToken: true,
      },
      [
        {
          from: addresses.base.aeroTokenAddress,
          to: addresses.base.wethTokenAddress,
          stable: true,
          factory: addresses.base.aeroFactoryAddress,
        },
      ]
    );
  });

  it("config", async function () {
    const aeroTokenConfig = await harvester.rewardTokenConfigs(
      addresses.base.aeroTokenAddress
    );
    expect(aeroTokenConfig.liquidationLimit.toString()).to.be.equal("0");
    expect(aeroTokenConfig.allowedSlippageBps.toString()).to.be.equal("300");
    expect(aeroTokenConfig.harvestRewardBps.toString()).to.be.equal("100");
  });
});
