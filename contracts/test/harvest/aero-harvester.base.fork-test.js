const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { aeroOETHAMOFixture } = require("../_fixture");

describe("ForkTest: Harvest AERO", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await aeroOETHAMOFixture();
  });

  it("config", async function () {
    const { harvester, aerodromeEthStrategy } = fixture;

    const aeroTokenConfig = await harvester.rewardTokenConfigs(
      addresses.base.aeroTokenAddress
    );
    expect(aeroTokenConfig.liquidationLimit.toString()).to.be.equal("0");
    expect(aeroTokenConfig.allowedSlippageBps.toString()).to.be.equal("300");
    expect(aeroTokenConfig.harvestRewardBps.toString()).to.be.equal("100");

    expect(
      await harvester.supportedStrategies(aerodromeEthStrategy.address)
    ).to.be.eq(true);
  });
  it.only("should harvest and swap", async function () {
    const { harvester, aerodromeEthStrategy, oethVault } = fixture;
    await harvester.harvestAndSwap(aerodromeEthStrategy.address);
  });
});
